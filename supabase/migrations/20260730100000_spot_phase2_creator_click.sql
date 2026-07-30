-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : compteur de clics d'un lien creator
--
-- PostgREST ne sait pas écrire « clicks = clicks + 1 » : sans cette
-- fonction, l'application devrait lire puis réécrire, et deux visites
-- simultanées s'écraseraient l'une l'autre. Un seul UPDATE atomique
-- règle la question.
--
-- Réservée à service_role, cohérent avec creator_links qui n'a aucune
-- policy UPDATE : le compteur reste hors de portée du client. Rappel de
-- la migration précédente — le clic ne vaut rien, seule une commande
-- payée crée une commission.
-- ════════════════════════════════════════════════════════════════════

create or replace function spot.register_creator_click(p_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  update spot.creator_links
     set clicks = clicks + 1
   where code = p_code;
$$;

revoke execute on function spot.register_creator_click(text) from public;
grant  execute on function spot.register_creator_click(text) to service_role;
