-- ════════════════════════════════════════════════════════════════════
-- spot.admin_creators déclarait « tickets_sold bigint » mais rendait un
-- numeric : sum() d'un count() élargit en numeric, et plpgsql refuse la
-- ligne au moment de la rendre (« structure of query does not match
-- function result type »).
--
-- La base ne comptant encore aucun creator, aucune ligne n'était rendue
-- et l'erreur restait invisible. Elle serait apparue au premier creator
-- réel, c'est-à-dire en production.
-- ════════════════════════════════════════════════════════════════════

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
                        where t.order_id = c.order_id)), 0)::bigint,
         coalesce(sum(c.amount_xaf), 0)
  from spot.creator_links cl
  join spot.profiles p on p.id = cl.creator_id
  left join spot.commissions c on c.creator_link_id = cl.id
  group by p.id, p.full_name
  order by coalesce(sum(c.amount_xaf), 0) desc, p.full_name
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke execute on function spot.admin_creators(integer) from public;
grant execute on function spot.admin_creators(integer) to authenticated;
