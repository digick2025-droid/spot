-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : index du badge de la cloche
--
-- getUnreadNotificationCount tourne sur CHAQUE page : il est lu depuis
-- le layout racine. Sa requête est « combien de non-lues pour moi »,
-- mais le seul index disponible était (user_id, created_at desc) : rien
-- n'y porte sur read_at. Postgres parcourait donc toutes les
-- notifications de la personne — lues comprises, et ce sont elles qui
-- s'accumulent — pour n'en compter qu'une poignée.
--
-- Le coût grandit avec l'historique, pas avec ce qui est affiché : au
-- bout d'un an d'usage, le badge « 0 » serait devenu la requête la plus
-- chère du rendu, sur toutes les pages du site.
--
-- Index partiel : il ne contient que les lignes non lues. Une fois la
-- notification ouverte, elle en sort. Il reste donc minuscule quoi qu'il
-- arrive, et le compte se lit dedans sans toucher à la table. C'est la
-- même forme que commissions_due_idx, pour la même raison.
--
-- « create index » simple et non « concurrently » : la table est encore
-- vide, le verrou est instantané, et concurrently ne peut pas tourner
-- dans la transaction d'une migration.
-- ════════════════════════════════════════════════════════════════════

create index notifications_unread_idx
  on spot.notifications (user_id)
  where read_at is null;
