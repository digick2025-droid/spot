-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 1 : passage d'une commande à « payée » et émission des
-- billets, en une seule transaction.
--
-- Pourquoi en base plutôt que dans le code applicatif : supabase-js ne
-- sait pas ouvrir de transaction. Or trois écritures doivent réussir ou
-- échouer ensemble — statut de la commande, décrément du stock, création
-- des billets. Un webhook rejoué ou deux webhooks concurrents ne doivent
-- jamais émettre les billets deux fois : le SELECT ... FOR UPDATE
-- sérialise les appels sur la même commande.
-- ════════════════════════════════════════════════════════════════════

create or replace function spot.mark_order_paid(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order    spot.orders;
  v_item     record;
  v_i        integer;
  v_created  integer := 0;
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

  return v_created;
end;
$$;

revoke execute on function spot.mark_order_paid(uuid) from public;

-- ── Échec de paiement ───────────────────────────────────────────────
create or replace function spot.mark_order_failed(p_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status spot.order_status;
begin
  select status into v_status from spot.orders where id = p_order_id for update;

  if not found then
    raise exception 'Commande % introuvable', p_order_id;
  end if;

  -- Une commande déjà payée ne redevient jamais « échouée » : un webhook
  -- d'échec arrivé en retard ne doit pas invalider des billets émis.
  if v_status = 'paid' then
    return;
  end if;

  update spot.orders
     set status = 'failed', failure_note = p_note
   where id = p_order_id;
end;
$$;

revoke execute on function spot.mark_order_failed(uuid, text) from public;
