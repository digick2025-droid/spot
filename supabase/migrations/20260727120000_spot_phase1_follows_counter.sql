-- ════════════════════════════════════════════════════════════════════
-- organizers.followers_count était un compteur mort : rien ne
-- l'alimentait, alors que le classement des organisateurs suggérés s'y
-- appuie. Maintenant que l'accueil permet de suivre un organisateur, un
-- trigger tient le compteur à jour.
--
-- SECURITY DEFINER obligatoire : le follower n'a aucun droit UPDATE sur
-- spot.organizers (policy organizers_update_own réservée au
-- propriétaire). Le trigger ne touche qu'à cette colonne dénormalisée.
-- ════════════════════════════════════════════════════════════════════

create or replace function spot_private.sync_followers_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update spot.organizers
       set followers_count = followers_count + 1
     where id = new.organizer_id;
    return new;
  end if;

  -- greatest() : le check (followers_count >= 0) ne doit jamais faire
  -- échouer un désabonnement, même si le compteur a dérivé.
  update spot.organizers
     set followers_count = greatest(followers_count - 1, 0)
   where id = old.organizer_id;
  return old;
end;
$$;

revoke execute on function spot_private.sync_followers_count() from public;

create trigger follows_sync_followers_count
  after insert or delete on spot.follows
  for each row execute function spot_private.sync_followers_count();

-- Remise à niveau des compteurs existants.
update spot.organizers o
   set followers_count = (
     select count(*) from spot.follows f where f.organizer_id = o.id
   )
 where o.followers_count is distinct from (
     select count(*) from spot.follows f where f.organizer_id = o.id
   );
