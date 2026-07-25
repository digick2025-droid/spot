-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 1 : validation d'un billet à l'entrée.
--
-- Le verrou SELECT ... FOR UPDATE garantit qu'un billet ne peut pas être
-- consommé deux fois, même si deux portiers le scannent au même instant :
-- le second appel attend et voit le billet déjà « used ».
-- ════════════════════════════════════════════════════════════════════

create type spot.scan_outcome as enum (
  'ok',            -- billet valide, consommé à l'instant
  'already_used',  -- déjà scanné
  'void',          -- annulé
  'wrong_event',   -- billet d'un autre événement
  'not_found',     -- code inconnu ou secret incorrect
  'forbidden'      -- l'appelant n'organise pas cet événement
);

create or replace function spot.scan_ticket(
  p_code     text,
  p_secret   text,
  p_event_id uuid,
  p_scanner  uuid
)
returns table (
  outcome      spot.scan_outcome,
  ticket_id    uuid,
  holder_name  text,
  type_fr      text,
  type_en      text,
  scanned_at   timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket  spot.tickets;
  v_owns    boolean;
begin
  -- Autorisation d'abord : seul l'organisateur de l'événement scanne.
  select exists (
    select 1
    from spot.events e
    join spot.organizers o on o.id = e.organizer_id
    where e.id = p_event_id and o.owner_id = p_scanner
  ) into v_owns;

  if not v_owns then
    return query select 'forbidden'::spot.scan_outcome, null::uuid, null::text,
                        null::text, null::text, null::timestamptz;
    return;
  end if;

  select * into v_ticket
  from spot.tickets t
  where t.code = upper(trim(p_code))
  for update;

  -- Code inconnu et secret erroné donnent la même réponse : ne pas
  -- révéler qu'un code existe quand le secret ne suit pas.
  if not found
     or (p_secret is not null and v_ticket.secret <> p_secret) then
    return query select 'not_found'::spot.scan_outcome, null::uuid, null::text,
                        null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_ticket.event_id <> p_event_id then
    return query select 'wrong_event'::spot.scan_outcome, v_ticket.id, null::text,
                        null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_ticket.status = 'void' then
    return query select 'void'::spot.scan_outcome, v_ticket.id, null::text,
                        null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_ticket.status = 'used' then
    return query
      select 'already_used'::spot.scan_outcome, v_ticket.id, p.full_name,
             tt.name_fr, tt.name_en, v_ticket.scanned_at
      from spot.ticket_types tt
      left join spot.profiles p on p.id = v_ticket.holder_id
      where tt.id = v_ticket.ticket_type_id;
    return;
  end if;

  update spot.tickets
     set status = 'used', scanned_at = now(), scanned_by = p_scanner
   where id = v_ticket.id;

  return query
    select 'ok'::spot.scan_outcome, v_ticket.id, p.full_name,
           tt.name_fr, tt.name_en, now()
    from spot.ticket_types tt
    left join spot.profiles p on p.id = v_ticket.holder_id
    where tt.id = v_ticket.ticket_type_id;
end;
$$;

revoke execute on function spot.scan_ticket(text, text, uuid, uuid) from public;
