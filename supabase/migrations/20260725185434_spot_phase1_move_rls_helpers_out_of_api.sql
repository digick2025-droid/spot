-- ════════════════════════════════════════════════════════════════════
-- Les fonctions d'aide des policies vivaient dans « spot », qui est
-- exposé à l'API : PostgREST en faisait donc des endpoints /rpc/*.
-- Elles ne divulguent rien de sensible (owns_* ne parle que de
-- l'appelant), mais elles n'ont pas à faire partie de la surface
-- publique. On les déplace dans un schéma non exposé : les policies y
-- accèdent toujours, PostgREST ne les voit plus.
-- ════════════════════════════════════════════════════════════════════

create schema if not exists spot_private;
grant usage on schema spot_private to anon, authenticated, service_role;

create or replace function spot_private.owns_organizer(p_organizer_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from spot.organizers o
    where o.id = p_organizer_id and o.owner_id = (select auth.uid())
  );
$$;

create or replace function spot_private.owns_event(p_event_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from spot.events e
    join spot.organizers o on o.id = e.organizer_id
    where e.id = p_event_id and o.owner_id = (select auth.uid())
  );
$$;

create or replace function spot_private.event_is_public(p_event_id uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from spot.events e
    where e.id = p_event_id and e.status = 'published'
  );
$$;

revoke execute on function spot_private.owns_organizer(uuid)  from public;
revoke execute on function spot_private.owns_event(uuid)      from public;
revoke execute on function spot_private.event_is_public(uuid) from public;
grant execute on function spot_private.owns_organizer(uuid)  to authenticated;
grant execute on function spot_private.owns_event(uuid)      to authenticated;
grant execute on function spot_private.event_is_public(uuid) to anon, authenticated;

-- ── Bascule des policies vers les nouvelles fonctions ───────────────
alter policy events_select_own on spot.events
  using (spot_private.owns_organizer(organizer_id));
alter policy events_insert_own on spot.events
  with check (spot_private.owns_organizer(organizer_id));
alter policy events_update_own on spot.events
  using (spot_private.owns_organizer(organizer_id))
  with check (spot_private.owns_organizer(organizer_id));
alter policy events_delete_own on spot.events
  using (spot_private.owns_organizer(organizer_id));

alter policy ticket_types_select_public on spot.ticket_types
  using (spot_private.event_is_public(event_id));
alter policy ticket_types_select_own on spot.ticket_types
  using (spot_private.owns_event(event_id));
alter policy ticket_types_write_own on spot.ticket_types
  using (spot_private.owns_event(event_id))
  with check (spot_private.owns_event(event_id));

alter policy orders_select_event_owner on spot.orders
  using (spot_private.owns_event(event_id));

alter policy order_items_select_own on spot.order_items
  using (exists (
    select 1 from spot.orders o
    where o.id = order_items.order_id
      and (o.user_id = (select auth.uid()) or spot_private.owns_event(o.event_id))
  ));

alter policy tickets_select_event_owner on spot.tickets
  using (spot_private.owns_event(event_id));

-- Plus référencées : on retire la surface API.
drop function if exists spot.owns_organizer(uuid);
drop function if exists spot.owns_event(uuid);
drop function if exists spot.event_is_public(uuid);
