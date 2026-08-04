-- ════════════════════════════════════════════════════════════════════
-- Affiches d'événement.
--
-- Jusqu'ici, l'écran de découverte n'avait qu'un emoji sur un dégradé
-- tiré au sort. L'organisateur peut désormais téléverser une affiche :
-- elle vit dans le bucket Storage « spot-posters », et l'événement n'en
-- garde que le chemin. Sans affiche, le dégradé et le glyph restent le
-- repli — aucune fiche existante n'est cassée.
--
-- Le chemin est <organizer_id>/<event_id>.<ext> : c'est le premier
-- segment qui porte l'autorisation d'écriture, donc un organisateur ne
-- peut jamais déposer un fichier dans le dossier d'un autre.
--
-- Le bucket est public en LECTURE : une affiche d'événement publié est
-- une image de promotion, servie par CDN sans jeton. L'écriture, elle,
-- reste sous RLS.
-- ════════════════════════════════════════════════════════════════════

alter table spot.events add column if not exists poster_path text;

comment on column spot.events.poster_path is
  'Chemin de l''affiche dans le bucket « spot-posters » (<organizer_id>/<event_id>.<ext>). Null : repli sur gradient + glyph.';

-- 5 Mio, et trois types d'image seulement : la limite est imposée par le
-- bucket lui-même, pas seulement par le formulaire, qui n'est qu'un
-- client parmi d'autres possibles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spot-posters',
  'spot-posters',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Le premier segment du chemin est-il un organisateur de l'appelant ?
--
-- La conversion en uuid est protégée : un nom de fichier déposé à la
-- racine du bucket, ou dans un dossier qui n'est pas un uuid, doit être
-- refusé, pas faire échouer la policy sur une erreur de cast.
create or replace function spot_private.owns_poster_folder(p_name text)
returns boolean language plpgsql security definer stable set search_path = '' as $$
declare
  v_organizer uuid;
begin
  begin
    v_organizer := ((storage.foldername(p_name))[1])::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1 from spot.organizers o
    where o.id = v_organizer and o.owner_id = (select auth.uid())
  );
end;
$$;

revoke execute on function spot_private.owns_poster_folder(text) from public;
grant execute on function spot_private.owns_poster_folder(text) to authenticated;

-- ── Policies, toutes bornées au bucket ──────────────────────────────
-- storage.objects est commun à tout le projet Supabase : chaque policy
-- commence donc par filtrer sur bucket_id, faute de quoi elle ouvrirait
-- des droits sur les fichiers d'une autre application.
create policy spot_posters_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'spot-posters');

create policy spot_posters_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'spot-posters' and spot_private.owns_poster_folder(name)
  );

create policy spot_posters_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'spot-posters' and spot_private.owns_poster_folder(name)
  )
  with check (
    bucket_id = 'spot-posters' and spot_private.owns_poster_folder(name)
  );

create policy spot_posters_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'spot-posters' and spot_private.owns_poster_folder(name)
  );
