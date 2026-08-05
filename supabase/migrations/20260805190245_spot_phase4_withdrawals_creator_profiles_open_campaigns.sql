-- ════════════════════════════════════════════════════════════════════
-- SPOT — Retraits, profils creators, campagnes ouvertes
--
-- Trois chantiers qui n'en font qu'un : sortir l'argent, savoir à qui on
-- le donne, et laisser les creators trouver les campagnes.
--
-- RETRAIT. Personne ne déclenche un virement en cliquant. Une demande
-- s'inscrit, l'admin verse depuis le compte Mobile Money de SPOT, puis
-- marque la ligne payée. C'est volontaire : l'adaptateur Campay n'a
-- jamais été confronté à un vrai compte, et un bouton qui promet un
-- virement immédiat sans pouvoir le tenir est pire qu'un formulaire.
--
-- Le MONTANT n'est jamais transmis par le client — même règle que
-- spot.open_payout. La fonction le recalcule sous verrou depuis les
-- ventes, les frais et les commissions. Un navigateur qui rejouerait la
-- requête ne peut ni choisir la somme, ni la demander deux fois : un
-- index partiel n'autorise qu'une demande ouverte à la fois.
--
-- PROFIL CREATOR. Les nombres d'abonnés sont DÉCLARÉS par le creator,
-- pas mesurés : SPOT n'est connecté à aucune API de réseau social. Les
-- écrans doivent le dire, faute de quoi un organisateur choisirait sur
-- la foi d'un chiffre que personne n'a vérifié.
--
-- CAMPAGNES OUVERTES. open_to_creators ne change pas qui peut rejoindre
-- — l'adhésion reste ce qu'elle était, l'identifiant de campagne tenant
-- lieu d'invitation. Il change qui peut TROUVER la campagne : une
-- campagne fermée reste invisible au catalogue, et son organisateur
-- garde la main sur qui porte son événement.
-- ════════════════════════════════════════════════════════════════════

-- ── Demandes de retrait ─────────────────────────────────────────────
create type spot.withdrawal_status as enum ('requested', 'paid', 'rejected');
create type spot.withdrawal_kind   as enum ('organizer', 'creator');

create table spot.withdrawals (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  kind          spot.withdrawal_kind not null,
  -- Le demandeur, toujours. C'est lui qui voit la ligne dans son espace.
  user_id       uuid not null references spot.profiles (id) on delete restrict,
  -- Rempli selon le camp : la fiche pour un organisateur, la campagne
  -- pour un creator (ses gains se comptent campagne par campagne).
  organizer_id  uuid references spot.organizers (id) on delete restrict,
  campaign_id   uuid references spot.campaigns (id) on delete restrict,
  amount_xaf    integer not null check (amount_xaf > 0),
  phone         text not null,
  channel       spot.payment_channel not null,
  status        spot.withdrawal_status not null default 'requested',
  note          text,
  created_at    timestamptz not null default now(),
  settled_at    timestamptz,
  constraint withdrawals_open_has_no_timestamp
    check ((status = 'requested') = (settled_at is null)),
  constraint withdrawals_target_matches_kind check (
    (kind = 'organizer' and organizer_id is not null and campaign_id is null)
    or
    (kind = 'creator'   and organizer_id is null     and campaign_id is not null)
  )
);

create index withdrawals_user_idx on spot.withdrawals (user_id, created_at desc);
create index withdrawals_open_idx on spot.withdrawals (status, created_at)
  where status = 'requested';

-- Une seule demande ouverte à la fois, de chaque côté. C'est ce qui
-- rend le bouton idempotent : un double clic ne fabrique pas deux
-- demandes du même solde.
create unique index withdrawals_one_open_per_organizer
  on spot.withdrawals (organizer_id)
  where status = 'requested' and kind = 'organizer';

create unique index withdrawals_one_open_per_creator_campaign
  on spot.withdrawals (user_id, campaign_id)
  where status = 'requested' and kind = 'creator';

alter table spot.withdrawals enable row level security;

create policy withdrawals_select_own on spot.withdrawals
  for select to authenticated
  using (user_id = (select auth.uid()));

-- L'organisateur voit les demandes de retrait des creators de ses
-- campagnes : c'est lui qui verse, il doit savoir qui attend.
create policy withdrawals_select_campaign_owner on spot.withdrawals
  for select to authenticated
  using (campaign_id is not null and spot_private.owns_campaign(campaign_id));

create policy withdrawals_select_admin on spot.withdrawals
  for select to authenticated
  using (spot_private.is_admin());

-- Aucune policy d'écriture : les demandes naissent par les fonctions
-- ci-dessous, et ne se règlent que par le serveur.
grant select on spot.withdrawals to authenticated;
grant all    on spot.withdrawals to service_role;

-- ── Solde d'un organisateur, sans contrôle d'accès ──────────────────
-- Réservée au serveur et aux fonctions qui l'appellent : elle ne
-- vérifie rien, c'est son appelant qui doit le faire. D'où le schéma
-- privé, hors de l'API PostgREST.
--
-- Ce que SPOT a encaissé pour ses événements, moins ce que la
-- plateforme prélève, moins ce qui est promis aux creators — dû ou déjà
-- versé, l'organisateur ne le reverra pas — moins ce qui est déjà sorti
-- ou réservé par une demande en cours.
create or replace function spot_private.organizer_balance(p_organizer_id uuid)
returns table (
  revenue_xaf              bigint,
  platform_fees_xaf        bigint,
  creator_commissions_xaf  bigint,
  withdrawn_xaf            bigint,
  requested_xaf            bigint,
  available_xaf            bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with rev as (
    select coalesce(sum(o.total_xaf), 0)::bigint as v
    from spot.orders o
    join spot.events e on e.id = o.event_id
    where e.organizer_id = p_organizer_id
      and o.status = 'paid'
  ),
  fees as (
    select coalesce(sum(f.amount_xaf), 0)::bigint as v
    from spot.platform_fees f
    where f.organizer_id = p_organizer_id
  ),
  com as (
    select coalesce(sum(c.amount_xaf), 0)::bigint as v
    from spot.commissions c
    join spot.campaigns ca on ca.id = c.campaign_id
    join spot.events e     on e.id = ca.event_id
    where e.organizer_id = p_organizer_id
  ),
  wd as (
    select
      coalesce(sum(w.amount_xaf) filter (where w.status = 'paid'), 0)::bigint      as paid,
      coalesce(sum(w.amount_xaf) filter (where w.status = 'requested'), 0)::bigint as req
    from spot.withdrawals w
    where w.kind = 'organizer'
      and w.organizer_id = p_organizer_id
  )
  select
    rev.v, fees.v, com.v, wd.paid, wd.req,
    -- Jamais négatif : un solde qui passerait sous zéro (remboursement,
    -- taux relevé après coup) est une dette, pas un retrait possible.
    greatest(rev.v - fees.v - com.v - wd.paid - wd.req, 0)
  from rev, fees, com, wd;
$$;

revoke execute on function spot_private.organizer_balance(uuid) from public;

-- ── Le même solde, pour l'organisateur lui-même ─────────────────────
create or replace function spot.organizer_balance(p_organizer_id uuid)
returns table (
  revenue_xaf              bigint,
  platform_fees_xaf        bigint,
  creator_commissions_xaf  bigint,
  withdrawn_xaf            bigint,
  requested_xaf            bigint,
  available_xaf            bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (spot_private.owns_organizer(p_organizer_id) or spot_private.is_admin()) then
    raise exception 'Solde de l''organisateur % : accès refusé', p_organizer_id;
  end if;

  return query select * from spot_private.organizer_balance(p_organizer_id);
end;
$$;

revoke execute on function spot.organizer_balance(uuid) from public;
grant  execute on function spot.organizer_balance(uuid) to authenticated, service_role;

-- ── Ouverture d'une demande de retrait — organisateur ───────────────
-- Renvoie zéro ligne quand il n'y a rien à retirer : ni demande à zéro,
-- ni erreur. Même contrat que spot.open_payout.
create or replace function spot.request_organizer_withdrawal(
  p_organizer_id uuid,
  p_user_id      uuid,
  p_reference    text,
  p_phone        text,
  p_channel      spot.payment_channel
)
returns table (o_id uuid, o_amount_xaf integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_available bigint;
  v_id        uuid;
begin
  -- Verrou sur la fiche : deux clics simultanés passent l'un après
  -- l'autre, et le second lit un solde déjà amputé de la demande du
  -- premier. Sans lui, les deux verraient le même solde entier.
  perform 1 from spot.organizers where id = p_organizer_id for update;
  if not found then
    raise exception 'Organisateur % introuvable', p_organizer_id;
  end if;

  select b.available_xaf into v_available
  from spot_private.organizer_balance(p_organizer_id) b;

  if coalesce(v_available, 0) <= 0 then
    return;
  end if;

  insert into spot.withdrawals (
    reference, kind, user_id, organizer_id, amount_xaf, phone, channel
  )
  values (
    p_reference, 'organizer', p_user_id, p_organizer_id,
    v_available::integer, p_phone, p_channel
  )
  returning id into v_id;

  return query select v_id, v_available::integer;
end;
$$;

revoke execute on function spot.request_organizer_withdrawal(uuid, uuid, text, text, spot.payment_channel) from public;

-- ── Ouverture d'une demande de retrait — creator ────────────────────
-- Le creator ne reçoit pas d'argent de SPOT : c'est l'organisateur qui
-- ordonne le versement de ce qu'il doit. La demande est donc un signal
-- adressé à l'organisateur, pas un mouvement de fonds — d'où le montant
-- calculé sur les seules commissions encore dues de la campagne.
create or replace function spot.request_creator_withdrawal(
  p_campaign_id uuid,
  p_creator_id  uuid,
  p_reference   text,
  p_phone       text,
  p_channel     spot.payment_channel
)
returns table (o_id uuid, o_amount_xaf integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due bigint;
  v_id  uuid;
begin
  select coalesce(sum(c.amount_xaf), 0)::bigint into v_due
  from spot.commissions c
  where c.campaign_id = p_campaign_id
    and c.creator_id  = p_creator_id
    and c.payout_id is null;

  if v_due <= 0 then
    return;
  end if;

  insert into spot.withdrawals (
    reference, kind, user_id, campaign_id, amount_xaf, phone, channel
  )
  values (
    p_reference, 'creator', p_creator_id, p_campaign_id,
    v_due::integer, p_phone, p_channel
  )
  returning id into v_id;

  return query select v_id, v_due::integer;
end;
$$;

revoke execute on function spot.request_creator_withdrawal(uuid, uuid, text, text, spot.payment_channel) from public;

-- ── Règlement d'une demande, par l'admin ────────────────────────────
create or replace function spot.settle_withdrawal(
  p_withdrawal_id uuid,
  p_status        spot.withdrawal_status,
  p_note          text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status spot.withdrawal_status;
begin
  if p_status = 'requested' then
    raise exception 'Une demande ne se règle pas en « requested »';
  end if;

  select status into v_status
  from spot.withdrawals
  where id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Demande de retrait % introuvable', p_withdrawal_id;
  end if;

  -- Déjà réglée : rejeu inoffensif.
  if v_status <> 'requested' then
    return false;
  end if;

  update spot.withdrawals
     set status = p_status,
         settled_at = now(),
         note = coalesce(p_note, note)
   where id = p_withdrawal_id;

  return true;
end;
$$;

revoke execute on function spot.settle_withdrawal(uuid, spot.withdrawal_status, text) from public;

-- ── La demande d'un creator se ferme quand le versement s'ouvre ─────
-- Par déclencheur plutôt qu'en réécrivant spot.open_payout : le chemin
-- de l'argent, lui, n'a pas à bouger pour ça. Si le versement échoue
-- ensuite, fail_payout rend les commissions au dû et le creator peut
-- redemander — l'index partiel ne bloque que les demandes ouvertes.
create or replace function spot_private.close_creator_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update spot.withdrawals
     set status = 'paid',
         settled_at = now(),
         note = coalesce(note, 'payout_opened')
   where kind = 'creator'
     and campaign_id = new.campaign_id
     and user_id     = new.creator_id
     and status      = 'requested';
  return new;
end;
$$;

create trigger payouts_close_creator_withdrawal
  after insert on spot.payouts
  for each row execute function spot_private.close_creator_withdrawal();

-- ── Profil public d'un creator ──────────────────────────────────────
create type spot.social_network as enum (
  'instagram', 'tiktok', 'facebook', 'youtube', 'x', 'snapchat', 'whatsapp'
);

create table spot.creator_profiles (
  id            uuid primary key references spot.profiles (id) on delete cascade,
  -- Le pseudo est l'adresse publique du creator : minuscules, sans
  -- espace, stable. C'est ce qu'on écrit dans une story.
  handle        text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name  text not null check (char_length(btrim(display_name)) between 2 and 60),
  bio_fr        text check (char_length(bio_fr) <= 400),
  bio_en        text check (char_length(bio_en) <= 400),
  city          text check (char_length(city) <= 60),
  glyph         text,
  gradient      text,
  verified      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table spot.creator_profiles is
  'Carte de visite d''un creator, montrée aux organisateurs qui choisissent qui portera leur événement.';

create trigger creator_profiles_set_updated_at
  before update on spot.creator_profiles
  for each row execute function spot.set_updated_at();

-- ── Audience déclarée, réseau par réseau ────────────────────────────
create table spot.creator_socials (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references spot.creator_profiles (id) on delete cascade,
  network         spot.social_network not null,
  handle          text not null check (char_length(btrim(handle)) between 1 and 60),
  -- Déclaré, jamais mesuré. Le plafond n'est pas de la coquetterie : il
  -- empêche le compteur d'une plateforme de 30 millions d'habitants
  -- d'afficher un milliard d'abonnés par faute de frappe.
  followers_count integer not null default 0
                  check (followers_count >= 0 and followers_count <= 500000000),
  updated_at      timestamptz not null default now(),
  unique (creator_id, network)
);

comment on column spot.creator_socials.followers_count is
  'Nombre d''abonnés DÉCLARÉ par le creator. Aucune API de réseau social n''est branchée : les écrans doivent présenter ce chiffre comme une déclaration.';

create index creator_socials_creator_idx on spot.creator_socials (creator_id);

create trigger creator_socials_set_updated_at
  before update on spot.creator_socials
  for each row execute function spot.set_updated_at();

-- ── « Vérifié » ne se donne pas soi-même ────────────────────────────
create or replace function spot_private.guard_creator_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not spot_private.is_admin() then
    new.verified := coalesce(old.verified, false);
  end if;
  return new;
end;
$$;

create trigger creator_profiles_guard_verified
  before insert or update on spot.creator_profiles
  for each row execute function spot_private.guard_creator_verified();

-- ── RLS des profils creators ────────────────────────────────────────
-- Lecture ouverte à tout compte connecté : c'est une carte de visite,
-- elle ne contient que ce que le creator a choisi de montrer. Ni
-- e-mail, ni téléphone, ni numéro de versement n'habitent ici.
alter table spot.creator_profiles enable row level security;
alter table spot.creator_socials  enable row level security;

create policy creator_profiles_select_all on spot.creator_profiles
  for select to authenticated
  using (true);

create policy creator_profiles_insert_own on spot.creator_profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy creator_profiles_update_own on spot.creator_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy creator_socials_select_all on spot.creator_socials
  for select to authenticated
  using (true);

create policy creator_socials_write_own on spot.creator_socials
  for all to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

grant select                         on spot.creator_profiles to authenticated;
grant insert, update                 on spot.creator_profiles to authenticated;
grant select, insert, update, delete on spot.creator_socials  to authenticated;
grant all on spot.creator_profiles to service_role;
grant all on spot.creator_socials  to service_role;

-- ── Campagnes ouvertes au catalogue ─────────────────────────────────
-- Fermée par défaut : une campagne existante ne change pas de régime
-- parce qu'on a ajouté une colonne.
alter table spot.campaigns
  add column open_to_creators boolean not null default false;

comment on column spot.campaigns.open_to_creators is
  'Vrai quand la campagne se montre dans le catalogue des creators. N''ouvre aucun droit d''écriture : l''adhésion passe par le même chemin qu''une invitation.';

create index campaigns_open_idx on spot.campaigns (open_to_creators, status)
  where open_to_creators;

-- Une campagne ouverte se lit par n'importe quel creator — sans quoi le
-- catalogue serait vide sous l'identité de celui qui le consulte. Elle
-- ne devient visible que si son événement l'est aussi.
create policy campaigns_select_open on spot.campaigns
  for select to authenticated
  using (
    open_to_creators
    and status = 'active'
    and spot_private.event_is_public(event_id)
  );
