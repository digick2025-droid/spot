-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 1 MVP : structure du schéma « spot »
-- Le schéma « public » appartient à une autre application : jamais touché.
-- ════════════════════════════════════════════════════════════════════

create schema if not exists spot;

grant usage on schema spot to anon, authenticated, service_role;

-- ── Types ───────────────────────────────────────────────────────────
create type spot.user_role       as enum ('participant', 'organizer', 'creator', 'admin');
create type spot.event_status    as enum ('draft', 'published', 'cancelled', 'ended');
create type spot.order_status    as enum ('pending', 'paid', 'failed', 'expired', 'refunded');
create type spot.ticket_status   as enum ('valid', 'used', 'void');
create type spot.payment_channel as enum ('mtn_momo', 'orange_money');

-- ── Utilitaire : horodatage de modification ─────────────────────────
create or replace function spot.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── profiles : miroir SPOT de auth.users ────────────────────────────
-- Créé paresseusement à la première connexion SPOT (pas de trigger sur
-- auth.users : cette table est partagée avec l'autre application).
create table spot.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  role        spot.user_role not null default 'participant',
  locale      text not null default 'fr' check (locale in ('fr', 'en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on spot.profiles
  for each row execute function spot.set_updated_at();

-- ── categories ──────────────────────────────────────────────────────
create table spot.categories (
  key       text primary key,
  emoji     text not null,
  label_fr  text not null,
  label_en  text not null,
  sort      integer not null default 0
);

-- ── organizers ──────────────────────────────────────────────────────
create table spot.organizers (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references spot.profiles (id) on delete cascade,
  name             text not null,
  slug             text not null unique,
  glyph            text,
  gradient         text,
  bio_fr           text,
  bio_en           text,
  followers_count  integer not null default 0 check (followers_count >= 0),
  verified         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index organizers_owner_id_idx on spot.organizers (owner_id);

create trigger organizers_set_updated_at
  before update on spot.organizers
  for each row execute function spot.set_updated_at();

-- ── events ──────────────────────────────────────────────────────────
create table spot.events (
  id              uuid primary key default gen_random_uuid(),
  organizer_id    uuid not null references spot.organizers (id) on delete cascade,
  category_key    text references spot.categories (key),
  title           text not null,
  slug            text not null unique,
  description_fr  text,
  description_en  text,
  city            text not null,
  venue           text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  glyph           text,
  gradient        text,
  status          spot.event_status not null default 'draft',
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint events_ends_after_starts check (ends_at is null or ends_at > starts_at)
);

create index events_organizer_id_idx  on spot.events (organizer_id);
create index events_starts_at_idx     on spot.events (starts_at);
create index events_published_idx     on spot.events (status, starts_at) where status = 'published';
create index events_city_idx          on spot.events (city);
create index events_category_key_idx  on spot.events (category_key);

create trigger events_set_updated_at
  before update on spot.events
  for each row execute function spot.set_updated_at();

-- ── ticket_types : Standard / VIP … ─────────────────────────────────
create table spot.ticket_types (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references spot.events (id) on delete cascade,
  name_fr         text not null,
  name_en         text not null,
  price_xaf       integer not null check (price_xaf >= 0),
  quantity_total  integer not null check (quantity_total > 0),
  quantity_sold   integer not null default 0 check (quantity_sold >= 0),
  sort            integer not null default 0,
  created_at      timestamptz not null default now(),
  constraint ticket_types_not_oversold check (quantity_sold <= quantity_total)
);

create index ticket_types_event_id_idx on spot.ticket_types (event_id, sort);

-- ── orders ──────────────────────────────────────────────────────────
-- Le statut ne bascule JAMAIS côté client : seul le serveur (service_role),
-- après réception du webhook signé, passe une commande à « paid ».
create table spot.orders (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique,
  user_id       uuid not null references spot.profiles (id) on delete restrict,
  event_id      uuid not null references spot.events (id) on delete restrict,
  status        spot.order_status not null default 'pending',
  total_xaf     integer not null check (total_xaf >= 0),
  channel       spot.payment_channel,
  payer_phone   text,
  provider      text,
  provider_ref  text,
  failure_note  text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '15 minutes',
  paid_at       timestamptz,
  constraint orders_paid_needs_timestamp
    check ((status = 'paid') = (paid_at is not null))
);

create index orders_user_id_idx  on spot.orders (user_id, created_at desc);
create index orders_event_id_idx on spot.orders (event_id);
create unique index orders_provider_ref_uniq
  on spot.orders (provider, provider_ref)
  where provider_ref is not null;

-- ── order_items ─────────────────────────────────────────────────────
create table spot.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references spot.orders (id) on delete cascade,
  ticket_type_id  uuid not null references spot.ticket_types (id) on delete restrict,
  quantity        integer not null check (quantity > 0),
  unit_price_xaf  integer not null check (unit_price_xaf >= 0)
);

create index order_items_order_id_idx on spot.order_items (order_id);

-- ── tickets ─────────────────────────────────────────────────────────
-- Émis exclusivement par le serveur, à la réception du webhook « paid ».
create table spot.tickets (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references spot.orders (id) on delete restrict,
  event_id        uuid not null references spot.events (id) on delete restrict,
  ticket_type_id  uuid not null references spot.ticket_types (id) on delete restrict,
  holder_id       uuid not null references spot.profiles (id) on delete restrict,
  code            text not null unique,
  secret          text not null,
  status          spot.ticket_status not null default 'valid',
  scanned_at      timestamptz,
  scanned_by      uuid references spot.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint tickets_used_needs_timestamp
    check ((status = 'used') = (scanned_at is not null))
);

create index tickets_holder_id_idx on spot.tickets (holder_id, created_at desc);
create index tickets_event_id_idx  on spot.tickets (event_id);
create index tickets_order_id_idx  on spot.tickets (order_id);

-- ── payment_events : idempotence et audit des webhooks ──────────────
-- Aucun accès client (RLS activée, aucune policy) : service_role seul.
create table spot.payment_events (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null,
  external_id      text not null,
  event_type       text,
  signature_valid  boolean not null,
  order_id         uuid references spot.orders (id) on delete set null,
  payload          jsonb not null,
  received_at      timestamptz not null default now(),
  processed_at     timestamptz,
  constraint payment_events_provider_external_uniq unique (provider, external_id)
);

create index payment_events_order_id_idx on spot.payment_events (order_id);

-- ── follows ─────────────────────────────────────────────────────────
create table spot.follows (
  user_id       uuid not null references spot.profiles (id) on delete cascade,
  organizer_id  uuid not null references spot.organizers (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, organizer_id)
);

create index follows_organizer_id_idx on spot.follows (organizer_id);
