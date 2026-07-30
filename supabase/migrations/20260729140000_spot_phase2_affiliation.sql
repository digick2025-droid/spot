-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : affiliation creators (suivi, sans versement)
--
-- Un organisateur ouvre une campagne sur son événement et y invite des
-- creators. Chaque creator reçoit un lien unique ; les clics sont
-- comptés, et une commande payée arrivée par ce lien produit une ligne
-- de commission due.
--
-- Règle centrale : LE CLIC NE VAUT RIEN. Il n'alimente qu'un compteur
-- d'affichage. L'argent ne suit qu'une commande réellement passée à
-- « paid », donc validée par le webhook signé. Gonfler ses clics ne
-- crée aucune commission.
--
-- Le montant est figé à l'encaissement (base_xaf + amount_xaf) : si
-- l'organisateur change son taux ensuite, ce qui est dû ne bouge pas.
-- ════════════════════════════════════════════════════════════════════

create type spot.commission_kind as enum ('percent', 'fixed');
create type spot.campaign_status as enum ('active', 'paused', 'ended');

-- ── campaigns ───────────────────────────────────────────────────────
create table spot.campaigns (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references spot.events (id) on delete cascade,
  name              text not null,
  commission_kind   spot.commission_kind not null,
  -- « percent » : part du total de la commande. « fixed » : montant en
  -- FCFA par billet émis.
  commission_value  integer not null check (commission_value >= 0),
  status            spot.campaign_status not null default 'active',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint campaigns_percent_max check (
    commission_kind <> 'percent' or commission_value <= 100
  )
);

create index campaigns_event_id_idx on spot.campaigns (event_id);

create trigger campaigns_set_updated_at
  before update on spot.campaigns
  for each row execute function spot.set_updated_at();

-- ── creator_links ───────────────────────────────────────────────────
create table spot.creator_links (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references spot.campaigns (id) on delete cascade,
  creator_id   uuid not null references spot.profiles (id) on delete cascade,
  code         text not null unique,
  clicks       integer not null default 0 check (clicks >= 0),
  created_at   timestamptz not null default now(),
  -- Un seul lien par creator et par campagne : deux liens rendraient les
  -- statistiques ininterprétables.
  constraint creator_links_one_per_campaign unique (campaign_id, creator_id)
);

create index creator_links_creator_id_idx on spot.creator_links (creator_id);
create index creator_links_campaign_id_idx on spot.creator_links (campaign_id);

-- ── Attribution portée par la commande ──────────────────────────────
-- Le client n'a aucun droit d'écriture sur orders : cette colonne ne
-- peut donc être renseignée que par le serveur, à la création de la
-- commande, après validation du lien.
alter table spot.orders
  add column creator_link_id uuid references spot.creator_links (id) on delete set null;

create index orders_creator_link_id_idx
  on spot.orders (creator_link_id)
  where creator_link_id is not null;

-- ── commissions ─────────────────────────────────────────────────────
-- Écrites uniquement par mark_order_paid. Aucun droit d'écriture client.
create table spot.commissions (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references spot.orders (id) on delete cascade,
  creator_link_id  uuid not null references spot.creator_links (id) on delete restrict,
  creator_id       uuid not null references spot.profiles (id) on delete restrict,
  campaign_id      uuid not null references spot.campaigns (id) on delete restrict,
  base_xaf         integer not null check (base_xaf >= 0),
  amount_xaf       integer not null check (amount_xaf >= 0),
  created_at       timestamptz not null default now(),
  -- Une commande ne rémunère qu'une fois, quel que soit le nombre de
  -- rejeux du webhook.
  constraint commissions_order_uniq unique (order_id)
);

create index commissions_creator_id_idx on spot.commissions (creator_id, created_at desc);
create index commissions_campaign_id_idx on spot.commissions (campaign_id);

-- ── Aide RLS : l'appelant possède-t-il l'événement de la campagne ? ──
-- Dans spot_private : les policies y accèdent, PostgREST ne l'expose pas.
create or replace function spot_private.owns_campaign(p_campaign_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1
    from spot.campaigns c
    join spot.events e     on e.id = c.event_id
    join spot.organizers o on o.id = e.organizer_id
    where c.id = p_campaign_id
      and o.owner_id = (select auth.uid())
  );
$$;

revoke execute on function spot_private.owns_campaign(uuid) from public;
grant  execute on function spot_private.owns_campaign(uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table spot.campaigns     enable row level security;
alter table spot.creator_links enable row level security;
alter table spot.commissions   enable row level security;

-- campaigns : l'organisateur pilote les siennes ; le creator invité la
-- lit pour connaître le taux qui le concerne.
create policy campaigns_rw_owner on spot.campaigns
  for all to authenticated
  using (spot_private.owns_event(event_id))
  with check (spot_private.owns_event(event_id));

create policy campaigns_select_creator on spot.campaigns
  for select to authenticated
  using (exists (
    select 1 from spot.creator_links l
    where l.campaign_id = campaigns.id
      and l.creator_id = (select auth.uid())
  ));

grant select, insert, update, delete on spot.campaigns to authenticated;

-- creator_links : l'organisateur invite et révoque ; le creator lit son
-- lien. Personne ne modifie « clicks » côté client — pas de policy
-- UPDATE, le compteur n'est incrémenté qu'en service_role.
create policy creator_links_rw_owner on spot.creator_links
  for all to authenticated
  using (spot_private.owns_campaign(campaign_id))
  with check (spot_private.owns_campaign(campaign_id));

create policy creator_links_select_own on spot.creator_links
  for select to authenticated
  using (creator_id = (select auth.uid()));

grant select, insert, delete on spot.creator_links to authenticated;

-- commissions : LECTURE SEULE, pour le creator concerné et pour
-- l'organisateur qui doit la payer.
create policy commissions_select_own on spot.commissions
  for select to authenticated
  using (creator_id = (select auth.uid()));

create policy commissions_select_owner on spot.commissions
  for select to authenticated
  using (spot_private.owns_campaign(campaign_id));

grant select on spot.commissions to authenticated;

grant all on spot.campaigns     to service_role;
grant all on spot.creator_links to service_role;
grant all on spot.commissions   to service_role;

-- ── Commission calculée à l'encaissement ────────────────────────────
-- Reprise de la fonction précédente, augmentée du bloc « commission ».
-- Elle reste le passage obligé : verrou FOR UPDATE, sortie immédiate
-- sur rejeu, donc une seule ligne de commission par commande.
create or replace function spot.mark_order_paid(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order       spot.orders;
  v_item        record;
  v_link        record;
  v_i           integer;
  v_created     integer := 0;
  v_points      integer;
  v_commission  integer;
begin
  -- Verrou : tout autre appel sur cette commande attend ici.
  select * into v_order
  from spot.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Commande % introuvable', p_order_id;
  end if;

  -- Déjà traitée : rejeu inoffensif, on ne réémet rien.
  if v_order.status = 'paid' then
    return 0;
  end if;

  if v_order.status not in ('pending', 'failed') then
    raise exception 'Commande % dans l''état % : passage à payée refusé',
      p_order_id, v_order.status;
  end if;

  update spot.orders
     set status = 'paid',
         paid_at = now(),
         failure_note = null
   where id = p_order_id;

  for v_item in
    select * from spot.order_items where order_id = p_order_id
  loop
    -- Décrément du stock. La contrainte ticket_types_not_oversold fait
    -- échouer toute la transaction en cas de survente.
    update spot.ticket_types
       set quantity_sold = quantity_sold + v_item.quantity
     where id = v_item.ticket_type_id;

    for v_i in 1..v_item.quantity loop
      insert into spot.tickets (
        order_id, event_id, ticket_type_id, holder_id, code, secret
      )
      values (
        p_order_id,
        v_order.event_id,
        v_item.ticket_type_id,
        v_order.user_id,
        upper(encode(extensions.gen_random_bytes(6), 'hex')),
        encode(extensions.gen_random_bytes(32), 'hex')
      );
      v_created := v_created + 1;
    end loop;
  end loop;

  -- Points du SPOT PASS. Le 100.0 est délibéré : « / 100 » ferait une
  -- division entière et tronquerait au lieu d'arrondir. Un événement
  -- gratuit ne crée pas de ligne à zéro.
  v_points := round(v_order.total_xaf / 100.0);
  if v_points > 0 then
    insert into spot.point_entries (user_id, order_id, points, reason)
    values (v_order.user_id, p_order_id, v_points, 'order_paid');
  end if;

  -- Commission du creator, quand la commande vient d'un lien de
  -- parrainage. Le taux est relu ici, jamais transmis par le client.
  if v_order.creator_link_id is not null then
    select l.id           as link_id,
           l.creator_id   as creator_id,
           c.id           as campaign_id,
           c.commission_kind,
           c.commission_value
      into v_link
      from spot.creator_links l
      join spot.campaigns c on c.id = l.campaign_id
     where l.id = v_order.creator_link_id;

    if found then
      if v_link.commission_kind = 'percent' then
        v_commission := round(
          v_order.total_xaf * v_link.commission_value / 100.0
        );
      else
        -- Montant fixe par billet émis.
        v_commission := v_link.commission_value * v_created;
      end if;

      if v_commission > 0 then
        insert into spot.commissions (
          order_id, creator_link_id, creator_id, campaign_id,
          base_xaf, amount_xaf
        )
        values (
          p_order_id, v_link.link_id, v_link.creator_id, v_link.campaign_id,
          v_order.total_xaf, v_commission
        );
      end if;
    end if;
  end if;

  return v_created;
end;
$$;

revoke execute on function spot.mark_order_paid(uuid) from public;
