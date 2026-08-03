-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : versement des commissions creators
--
-- L'affiliation savait déjà ce qui est DÛ (spot.commissions, figé à
-- l'encaissement). Il manquait le mouvement d'argent inverse : sortir
-- ces francs vers le Mobile Money du creator.
--
-- Qui paie quoi : la vente a été encaissée sur le compte agrégateur de
-- SPOT. L'organisateur n'avance donc rien — il ORDONNE le versement de
-- ce qu'il doit, et les fonds partent du même compte que celui qui a
-- collecté. Le creator, lui, ne déclenche jamais rien : il renseigne
-- seulement le numéro sur lequel il veut être payé.
--
-- Invariant central : UNE COMMISSION N'EST PAYÉE QU'UNE FOIS. Elle est
-- rattachée à un versement (commissions.payout_id) au moment où celui-ci
-- s'ouvre, dans la même transaction que la sélection des lignes, sous
-- verrou. Deux clics simultanés sur « Verser » ne peuvent donc pas
-- emporter deux fois la même commission : le second ne trouve plus rien
-- à payer.
--
-- Le rattachement n'est défait que par fail_payout, c'est-à-dire quand
-- l'opérateur a confirmé que l'argent n'est PAS parti. La somme
-- redevient alors due, et peut être retentée.
-- ════════════════════════════════════════════════════════════════════

create type spot.payout_status as enum ('pending', 'paid', 'failed');

-- ── Numéro de versement du creator ──────────────────────────────────
-- Distinct de profiles.phone, qui est un contact : on n'envoie pas de
-- l'argent sur un numéro saisi pour tout autre chose. Le creator doit
-- désigner explicitement sa destination.
alter table spot.profiles
  add column payout_phone text;

-- ── payouts ─────────────────────────────────────────────────────────
-- Écrite exclusivement en service_role. Le montant, le numéro et le
-- canal sont figés à l'ouverture : la trace de ce qui a été envoyé ne
-- dépend pas de ce que le profil deviendra ensuite.
create table spot.payouts (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  creator_id    uuid not null references spot.profiles (id) on delete restrict,
  campaign_id   uuid not null references spot.campaigns (id) on delete restrict,
  status        spot.payout_status not null default 'pending',
  amount_xaf    integer not null check (amount_xaf > 0),
  phone         text not null,
  channel       spot.payment_channel not null,
  provider      text,
  provider_ref  text,
  failure_note  text,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz,
  constraint payouts_paid_needs_timestamp
    check ((status = 'paid') = (paid_at is not null))
);

create index payouts_creator_id_idx  on spot.payouts (creator_id, created_at desc);
create index payouts_campaign_id_idx on spot.payouts (campaign_id);

-- Même garde-fou que sur orders : une référence d'agrégateur ne désigne
-- qu'un seul mouvement.
create unique index payouts_provider_ref_uniq
  on spot.payouts (provider, provider_ref)
  where provider_ref is not null;

-- ── Rattachement des commissions ────────────────────────────────────
-- « on delete restrict » : un versement ne s'efface pas, même raté. Il
-- reste au dossier.
alter table spot.commissions
  add column payout_id uuid references spot.payouts (id) on delete restrict;

create index commissions_payout_id_idx
  on spot.commissions (payout_id)
  where payout_id is not null;

-- Index de travail : « ce qui reste dû à ce creator sur cette campagne ».
create index commissions_due_idx
  on spot.commissions (campaign_id, creator_id)
  where payout_id is null;

-- ── Audit : un webhook peut désormais concerner un versement ────────
alter table spot.payment_events
  add column payout_id uuid references spot.payouts (id) on delete set null;

create index payment_events_payout_id_idx on spot.payment_events (payout_id);

-- ── RLS : lecture seule, pour les deux parties concernées ───────────
alter table spot.payouts enable row level security;

create policy payouts_select_own on spot.payouts
  for select to authenticated
  using (creator_id = (select auth.uid()));

create policy payouts_select_owner on spot.payouts
  for select to authenticated
  using (spot_private.owns_campaign(campaign_id));

-- Aucune policy d'écriture : ni le creator ni l'organisateur ne
-- fabriquent un versement. Seul le serveur, via les fonctions ci-dessous.
grant select on spot.payouts to authenticated;
grant all    on spot.payouts to service_role;

-- ── Ouverture d'un versement ────────────────────────────────────────
-- Sélection et rattachement dans la même transaction, sous verrou : le
-- passage obligé pour transformer des commissions dues en un ordre de
-- paiement. Renvoie zéro ligne quand il n'y a rien à verser.
create or replace function spot.open_payout(
  p_campaign_id uuid,
  p_creator_id  uuid,
  p_reference   text,
  p_phone       text,
  p_channel     spot.payment_channel
)
returns table (o_payout_id uuid, o_total_xaf integer, o_lines integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids     uuid[];
  v_amount  integer;
  v_payout  uuid;
begin
  -- Verrou sur les commissions encore dues. L'ordre stable évite les
  -- interblocages entre deux versements concurrents ; le prédicat
  -- « payout_id is null » est réévalué après attente, si bien qu'un
  -- appel concurrent qui vient de les rattacher les fait disparaître
  -- d'ici.
  select array_agg(c.id) into v_ids
  from (
    select id
    from spot.commissions
    where campaign_id = p_campaign_id
      and creator_id  = p_creator_id
      and payout_id is null
    order by created_at
    for update
  ) c;

  -- Rien à verser : ni ligne de versement à zéro, ni erreur.
  if v_ids is null then
    return;
  end if;

  select sum(c.amount_xaf) into v_amount
  from spot.commissions c
  where c.id = any(v_ids);

  insert into spot.payouts (
    reference, creator_id, campaign_id, amount_xaf, phone, channel
  )
  values (
    p_reference, p_creator_id, p_campaign_id, v_amount, p_phone, p_channel
  )
  returning id into v_payout;

  update spot.commissions
     set payout_id = v_payout
   where id = any(v_ids);

  return query select v_payout, v_amount, array_length(v_ids, 1);
end;
$$;

revoke execute on function spot.open_payout(uuid, uuid, text, text, spot.payment_channel) from public;

-- ── Confirmation par l'opérateur ────────────────────────────────────
-- Renvoie vrai si le versement vient de basculer, faux si l'appel était
-- sans effet (rejeu, ou conflit tracé dans failure_note).
create or replace function spot.settle_payout(
  p_payout_id    uuid,
  p_provider_ref text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status spot.payout_status;
begin
  select status into v_status
  from spot.payouts
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'Versement % introuvable', p_payout_id;
  end if;

  -- Rejeu du webhook : inoffensif.
  if v_status = 'paid' then
    return false;
  end if;

  -- Cas tordu : « payé » arrive après un « échoué » qui a déjà remis les
  -- commissions au pot. Les rattacher ici risquerait de payer deux fois
  -- les mêmes francs. On laisse donc le versement en échec et on le
  -- signale, pour arbitrage humain.
  if v_status = 'failed' then
    update spot.payouts
       set failure_note = 'Confirmation « payé » reçue après un échec : à vérifier à la main'
     where id = p_payout_id;
    return false;
  end if;

  update spot.payouts
     set status       = 'paid',
         paid_at      = now(),
         failure_note = null,
         provider_ref = coalesce(p_provider_ref, provider_ref)
   where id = p_payout_id;

  return true;
end;
$$;

revoke execute on function spot.settle_payout(uuid, text) from public;

-- ── Échec : l'argent n'est pas parti ────────────────────────────────
-- Les commissions redeviennent dues. C'est le seul chemin qui défait un
-- rattachement, et il n'est emprunté que sur confirmation de l'opérateur.
create or replace function spot.fail_payout(p_payout_id uuid, p_note text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status spot.payout_status;
begin
  select status into v_status
  from spot.payouts
  where id = p_payout_id
  for update;

  if not found then
    raise exception 'Versement % introuvable', p_payout_id;
  end if;

  -- Un versement confirmé ne redevient jamais un échec : un webhook
  -- d'échec en retard ne doit pas rendre dû ce qui a déjà été payé.
  if v_status <> 'pending' then
    return false;
  end if;

  update spot.payouts
     set status = 'failed', failure_note = p_note
   where id = p_payout_id;

  update spot.commissions
     set payout_id = null
   where payout_id = p_payout_id;

  return true;
end;
$$;

revoke execute on function spot.fail_payout(uuid, text) from public;
