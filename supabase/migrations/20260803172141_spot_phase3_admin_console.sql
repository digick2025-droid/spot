-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 3 : console d'administration (LECTURE SEULE)
--
-- Aucune écriture n'est ajoutée : la console ne fait que lire. Elle lit
-- en revanche à travers tout le produit, ce que la RLS interdit à juste
-- titre à un client ordinaire. Deux façons de l'ouvrir existaient :
-- élargir les policies de chaque table à l'administrateur, ou exposer
-- des fonctions qui rendent exactement les lignes de la console.
--
-- On prend la seconde. Élargir les policies aurait donné à une session
-- admin compromise le droit de tout balayer via PostgREST ; ici la forme
-- des données, leur tri et leur volume sont fixés côté base, et chaque
-- fonction porte son propre refus. Le rôle « admin » ne gagne aucun
-- droit sur les tables elles-mêmes.
-- ════════════════════════════════════════════════════════════════════

-- ── Le garde ────────────────────────────────────────────────────────
-- Dans spot_private, non exposé à l'API : PostgREST n'en fait pas un
-- endpoint, et les fonctions ci-dessous restent seules à s'en servir.
create or replace function spot_private.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from spot.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke execute on function spot_private.is_admin() from public;
grant execute on function spot_private.is_admin() to authenticated;

-- ── Cartouches du haut d'écran ──────────────────────────────────────
create or replace function spot.admin_kpis()
returns table (
  users_count            bigint,
  active_events          bigint,
  processed_volume_xaf   bigint,
  commissions_month_xaf  bigint
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from spot.profiles),
    -- « Actif » = publié et pas encore passé : un événement terminé ne
    -- dit rien de l'activité d'aujourd'hui.
    (select count(*) from spot.events e
      where e.status = 'published' and e.starts_at >= now()),
    -- Seules les commandes payées ont vu de l'argent circuler.
    (select coalesce(sum(o.total_xaf), 0) from spot.orders o
      where o.status = 'paid'),
    -- Commissions creators du mois calendaire en cours. SPOT ne prélève
    -- pas encore de part plateforme : c'est la seule commission réelle.
    (select coalesce(sum(c.amount_xaf), 0) from spot.commissions c
      where c.created_at >= date_trunc('month', now()));
end;
$$;

-- ── Onglet « Utilisateurs » ─────────────────────────────────────────
-- La maquette montre une colonne « Statut » (Actif / Suspendu). Aucune
-- suspension n'existe en base et la Phase 3 n'en introduit pas : on rend
-- le rôle, qui est réel, plutôt qu'un statut inventé toujours « Actif ».
create or replace function spot.admin_users(p_limit integer default 50)
returns table (
  user_id    uuid,
  full_name  text,
  phone      text,
  tickets    bigint,
  role       spot.user_role
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, p.phone,
         (select count(*) from spot.tickets t where t.holder_id = p.id),
         p.role
  from spot.profiles p
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ── Onglet « Organisateurs » ────────────────────────────────────────
-- Colonne « Plan » de la maquette : SPOT n'a pas d'offre payante. On
-- rend « vérifié », qui existe et se lit de la même façon.
create or replace function spot.admin_organizers(p_limit integer default 50)
returns table (
  organizer_id     uuid,
  name             text,
  glyph            text,
  events_count     bigint,
  followers_count  integer,
  verified         boolean
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select o.id, o.name, o.glyph,
         (select count(*) from spot.events e where e.organizer_id = o.id),
         o.followers_count, o.verified
  from spot.organizers o
  order by o.followers_count desc, o.name
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ── Onglet « Événements » ───────────────────────────────────────────
create or replace function spot.admin_events(p_limit integer default 50)
returns table (
  event_id   uuid,
  title      text,
  glyph      text,
  starts_at  timestamptz,
  sold       bigint,
  capacity   bigint,
  status     spot.event_status
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select e.id, e.title, e.glyph, e.starts_at,
         coalesce((select sum(tt.quantity_sold) from spot.ticket_types tt
                    where tt.event_id = e.id), 0),
         coalesce((select sum(tt.quantity_total) from spot.ticket_types tt
                    where tt.event_id = e.id), 0),
         e.status
  from spot.events e
  order by e.starts_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ── Onglet « Paiements » ────────────────────────────────────────────
-- Le numéro du payeur n'est PAS rendu : la console n'a pas besoin de
-- lire les téléphones des acheteurs pour surveiller les flux.
create or replace function spot.admin_payments(p_limit integer default 50)
returns table (
  order_id     uuid,
  reference    text,
  event_title  text,
  channel      spot.payment_channel,
  total_xaf    integer,
  status       spot.order_status,
  created_at   timestamptz
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select o.id, o.reference, e.title, o.channel, o.total_xaf, o.status, o.created_at
  from spot.orders o
  join spot.events e on e.id = o.event_id
  order by o.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ── Onglet « Commissions » ──────────────────────────────────────────
create or replace function spot.admin_commissions(p_limit integer default 50)
returns table (
  commission_id     uuid,
  creator_name      text,
  campaign_name     text,
  commission_kind   spot.commission_kind,
  commission_value  integer,
  amount_xaf        integer,
  created_at        timestamptz
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select c.id, p.full_name, ca.name, ca.commission_kind, ca.commission_value,
         c.amount_xaf, c.created_at
  from spot.commissions c
  join spot.profiles p  on p.id  = c.creator_id
  join spot.campaigns ca on ca.id = c.campaign_id
  order by c.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ── Onglet « Creators » ─────────────────────────────────────────────
-- Colonne « Réseau » de la maquette : SPOT ne collecte aucun compte
-- social. On rend le nombre de campagnes rejointes, qui est le fait
-- observable équivalent.
create or replace function spot.admin_creators(p_limit integer default 50)
returns table (
  creator_id      uuid,
  full_name       text,
  campaigns       bigint,
  tickets_sold    bigint,
  commission_xaf  bigint
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name,
         count(distinct cl.campaign_id),
         coalesce(sum((select count(*) from spot.tickets t
                        where t.order_id = c.order_id)), 0),
         coalesce(sum(c.amount_xaf), 0)
  from spot.creator_links cl
  join spot.profiles p on p.id = cl.creator_id
  left join spot.commissions c on c.creator_link_id = cl.id
  group by p.id, p.full_name
  order by coalesce(sum(c.amount_xaf), 0) desc, p.full_name
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ── Onglet « Points fidélité » ──────────────────────────────────────
create or replace function spot.admin_loyalty(p_limit integer default 50)
returns table (
  user_id           uuid,
  full_name         text,
  points            bigint,
  last_points       integer,
  last_event_title  text,
  last_at           timestamptz
)
language plpgsql security definer stable set search_path = '' as $$
begin
  if not spot_private.is_admin() then
    raise exception 'Console d''administration réservée aux administrateurs'
      using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name,
         coalesce(sum(pe.points), 0),
         last_entry.points,
         last_entry.title,
         last_entry.created_at
  from spot.profiles p
  join spot.point_entries pe on pe.user_id = p.id
  left join lateral (
    select pe2.points, pe2.created_at, e.title
    from spot.point_entries pe2
    left join spot.orders o on o.id = pe2.order_id
    left join spot.events e on e.id = o.event_id
    where pe2.user_id = p.id
    order by pe2.created_at desc
    limit 1
  ) as last_entry on true
  group by p.id, p.full_name, last_entry.points, last_entry.title, last_entry.created_at
  order by coalesce(sum(pe.points), 0) desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

-- ── Surface d'exécution ─────────────────────────────────────────────
-- anon n'a rien à faire ici : un visiteur non connecté ne peut pas être
-- administrateur, autant que l'appel n'existe pas pour lui.
revoke execute on function spot.admin_kpis()               from public;
revoke execute on function spot.admin_users(integer)       from public;
revoke execute on function spot.admin_organizers(integer)  from public;
revoke execute on function spot.admin_events(integer)      from public;
revoke execute on function spot.admin_payments(integer)    from public;
revoke execute on function spot.admin_commissions(integer) from public;
revoke execute on function spot.admin_creators(integer)    from public;
revoke execute on function spot.admin_loyalty(integer)     from public;

grant execute on function spot.admin_kpis()               to authenticated;
grant execute on function spot.admin_users(integer)       to authenticated;
grant execute on function spot.admin_organizers(integer)  to authenticated;
grant execute on function spot.admin_events(integer)      to authenticated;
grant execute on function spot.admin_payments(integer)    to authenticated;
grant execute on function spot.admin_commissions(integer) to authenticated;
grant execute on function spot.admin_creators(integer)    to authenticated;
grant execute on function spot.admin_loyalty(integer)     to authenticated;
