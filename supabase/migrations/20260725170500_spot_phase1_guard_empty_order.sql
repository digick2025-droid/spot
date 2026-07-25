-- Une commande sans ligne ne doit jamais devenir « payée » : elle
-- n'émettrait aucun billet tout en encaissant. Découvert en testant le
-- scan, où une commande vide était passée à « paid » sans effet visible.
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
  v_items    integer;
begin
  select * into v_order
  from spot.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Commande % introuvable', p_order_id;
  end if;

  if v_order.status = 'paid' then
    return 0;
  end if;

  if v_order.status not in ('pending', 'failed') then
    raise exception 'Commande % dans l''état % : passage à payée refusé',
      p_order_id, v_order.status;
  end if;

  select count(*) into v_items from spot.order_items where order_id = p_order_id;
  if v_items = 0 then
    raise exception 'Commande % sans ligne : passage à payée refusé', p_order_id;
  end if;

  update spot.orders
     set status = 'paid', paid_at = now(), failure_note = null
   where id = p_order_id;

  for v_item in select * from spot.order_items where order_id = p_order_id loop
    update spot.ticket_types
       set quantity_sold = quantity_sold + v_item.quantity
     where id = v_item.ticket_type_id;

    for v_i in 1..v_item.quantity loop
      insert into spot.tickets (order_id, event_id, ticket_type_id, holder_id, code, secret)
      values (
        p_order_id, v_order.event_id, v_item.ticket_type_id, v_order.user_id,
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
