-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 1 : RLS, policies et privilèges
--
-- Principe : le tunnel d'achat (orders, order_items, tickets) est en
-- LECTURE SEULE pour le client. Toute écriture passe par une Server
-- Action côté serveur qui recalcule les montants depuis la base — un
-- client ne peut donc pas forger une commande à 0 FCFA, ni s'émettre
-- un billet. Les billets naissent uniquement du webhook « paid ».
-- ════════════════════════════════════════════════════════════════════

-- ── Fonctions d'aide (SECURITY DEFINER : contournent la RLS pour
--    éviter la récursion dans les policies) ──────────────────────────
create or replace function spot.owns_organizer(p_organizer_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from spot.organizers o
    where o.id = p_organizer_id
      and o.owner_id = (select auth.uid())
  );
$$;

create or replace function spot.owns_event(p_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from spot.events e
    join spot.organizers o on o.id = e.organizer_id
    where e.id = p_event_id
      and o.owner_id = (select auth.uid())
  );
$$;

create or replace function spot.event_is_public(p_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from spot.events e
    where e.id = p_event_id
      and e.status = 'published'
  );
$$;

revoke execute on function spot.owns_organizer(uuid)  from public;
revoke execute on function spot.owns_event(uuid)      from public;
revoke execute on function spot.event_is_public(uuid) from public;
grant execute on function spot.owns_organizer(uuid)  to authenticated;
grant execute on function spot.owns_event(uuid)      to authenticated;
grant execute on function spot.event_is_public(uuid) to anon, authenticated;

-- ── Garde-fou : un client ne peut pas s'attribuer un rôle ───────────
-- Les appels serveur (service_role) ont auth.uid() nul et restent permis.
create or replace function spot.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and (select auth.uid()) is not null then
    raise exception 'Le rôle d''un profil ne peut pas être modifié par le client';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on spot.profiles
  for each row execute function spot.guard_profile_role();

-- ── Activation de la RLS partout ────────────────────────────────────
alter table spot.profiles       enable row level security;
alter table spot.categories     enable row level security;
alter table spot.organizers     enable row level security;
alter table spot.events         enable row level security;
alter table spot.ticket_types   enable row level security;
alter table spot.orders         enable row level security;
alter table spot.order_items    enable row level security;
alter table spot.tickets        enable row level security;
alter table spot.payment_events enable row level security;
alter table spot.follows        enable row level security;

-- ── profiles ────────────────────────────────────────────────────────
create policy profiles_select_own on spot.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own on spot.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own on spot.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

grant select, insert, update on spot.profiles to authenticated;

-- ── categories : référentiel public en lecture ──────────────────────
create policy categories_select_all on spot.categories
  for select to anon, authenticated
  using (true);

grant select on spot.categories to anon, authenticated;

-- ── organizers : fiches publiques, gérées par leur propriétaire ─────
create policy organizers_select_all on spot.organizers
  for select to anon, authenticated
  using (true);

create policy organizers_insert_own on spot.organizers
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy organizers_update_own on spot.organizers
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update on spot.organizers to anon, authenticated;
revoke insert, update on spot.organizers from anon;

-- ── events : publiés visibles de tous, brouillons réservés ──────────
create policy events_select_published on spot.events
  for select to anon, authenticated
  using (status = 'published');

create policy events_select_own on spot.events
  for select to authenticated
  using (spot.owns_organizer(organizer_id));

create policy events_insert_own on spot.events
  for insert to authenticated
  with check (spot.owns_organizer(organizer_id));

create policy events_update_own on spot.events
  for update to authenticated
  using (spot.owns_organizer(organizer_id))
  with check (spot.owns_organizer(organizer_id));

create policy events_delete_own on spot.events
  for delete to authenticated
  using (spot.owns_organizer(organizer_id));

grant select on spot.events to anon, authenticated;
grant insert, update, delete on spot.events to authenticated;

-- ── ticket_types ────────────────────────────────────────────────────
create policy ticket_types_select_public on spot.ticket_types
  for select to anon, authenticated
  using (spot.event_is_public(event_id));

create policy ticket_types_select_own on spot.ticket_types
  for select to authenticated
  using (spot.owns_event(event_id));

create policy ticket_types_write_own on spot.ticket_types
  for all to authenticated
  using (spot.owns_event(event_id))
  with check (spot.owns_event(event_id));

grant select on spot.ticket_types to anon, authenticated;
grant insert, update, delete on spot.ticket_types to authenticated;

-- ── orders : LECTURE SEULE pour le client ───────────────────────────
create policy orders_select_own on spot.orders
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy orders_select_event_owner on spot.orders
  for select to authenticated
  using (spot.owns_event(event_id));

grant select on spot.orders to authenticated;

-- ── order_items : LECTURE SEULE pour le client ──────────────────────
create policy order_items_select_own on spot.order_items
  for select to authenticated
  using (exists (
    select 1 from spot.orders o
    where o.id = order_items.order_id
      and (o.user_id = (select auth.uid()) or spot.owns_event(o.event_id))
  ));

grant select on spot.order_items to authenticated;

-- ── tickets : LECTURE SEULE pour le client ──────────────────────────
-- Le porteur voit ses billets ; l'organisateur voit ceux de son événement
-- (nécessaire au scan). Le champ « secret » n'est jamais servi au client :
-- les requêtes applicatives sélectionnent explicitement leurs colonnes.
create policy tickets_select_own on spot.tickets
  for select to authenticated
  using (holder_id = (select auth.uid()));

create policy tickets_select_event_owner on spot.tickets
  for select to authenticated
  using (spot.owns_event(event_id));

grant select on spot.tickets to authenticated;

-- ── follows ─────────────────────────────────────────────────────────
create policy follows_select_own on spot.follows
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy follows_insert_own on spot.follows
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy follows_delete_own on spot.follows
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on spot.follows to authenticated;

-- ── payment_events : RLS active, AUCUNE policy → refus total ────────
-- Seul service_role y accède (il contourne la RLS).

-- ── service_role : accès complet, y compris aux objets futurs ───────
grant all on all tables    in schema spot to service_role;
grant all on all sequences in schema spot to service_role;
grant all on all functions in schema spot to service_role;

alter default privileges in schema spot grant all on tables    to service_role;
alter default privileges in schema spot grant all on sequences to service_role;
alter default privileges in schema spot grant all on functions to service_role;
