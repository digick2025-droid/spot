-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : les cumuls d'affiliation redescendent en base
--
-- L'écran Creator et l'écran Campagnes affichent des sommes d'argent :
-- ce qui est dû, ce qui est en route, ce qui a été versé. Ces sommes
-- étaient calculées en JavaScript, à partir de la table entière —
-- « select * from commissions », puis une boucle. Trois défauts, du
-- plus grave au moins grave :
--
--  1. PostgREST plafonne le nombre de lignes rendues (1000 par défaut
--     chez Supabase) et TRONQUE SANS RIEN DIRE : ni erreur, ni signal.
--     Passé le millième encaissement attribué, un creator aurait vu ses
--     gains diminuer d'un rafraîchissement à l'autre, et l'organisateur
--     aurait dû moins qu'il ne doit. Des chiffres faux qui ont l'air
--     justes, sur de l'argent : c'est la raison d'être de ce fichier.
--
--  2. Chaque affichage transférait toutes les commissions visibles
--     jusqu'à Node pour n'en garder qu'une somme par lien.
--
--  3. La somme y était refaite à la main, alors que Postgres sait la
--     faire — et la fera juste.
--
-- Les vues ci-dessous groupent en base : une ligne par lien, pas une
-- par commission. Le volume rendu ne dépend plus du nombre de ventes.
--
-- « security_invoker = true » n'est pas un détail de confort : SANS LUI
-- une vue s'exécute avec les droits de son propriétaire et contourne la
-- RLS des tables qu'elle lit — ici, tout l'argent de tout le monde. Avec
-- lui, commissions_select_own / _owner s'appliquent comme avant, et
-- chacun ne groupe que ce qu'il avait déjà le droit de lire.
-- ════════════════════════════════════════════════════════════════════

-- ── Cumuls de commissions, par lien ─────────────────────────────────
-- Reprend exactement la répartition que faisait le TypeScript :
--
--   dû      = aucune ligne de versement rattachée ;
--   en cours= rattachée à un versement pas encore confirmé ;
--   versé   = rattachée à un versement confirmé « paid ».
--
-- La jointure sur payouts subit elle aussi la RLS de l'appelant, comme
-- l'embed PostgREST qu'elle remplace : les deux parties concernées par
-- une commission voient toujours le versement qui la porte, donc le
-- classement ne change pas. Un versement invisible ferait retomber sa
-- part dans « en cours » — c'était déjà le cas avant.
--
-- D'où « is distinct from » et non « <> » pour le en-cours : si la
-- jointure ne ramène rien, status vaut NULL, et « NULL <> 'paid' » vaut
-- NULL, donc faux. La part disparaîtrait des trois colonnes tout en
-- restant dans total_xaf — de l'argent visible dans un total et
-- introuvable dans son détail.
create view spot.commission_totals_by_link
with (security_invoker = true) as
  select
    c.creator_link_id,
    -- Repris pour que l'appelant puisse filtrer explicitement plutôt que
    -- de s'en remettre à la seule RLS : deux policies permissives se
    -- cumulent en OR, et l'espace Creator en a déjà fait les frais.
    c.creator_id,
    c.campaign_id,
    count(*)                                                    as commission_count,
    sum(c.amount_xaf)::bigint                                   as total_xaf,
    sum(case when c.payout_id is null
             then c.amount_xaf else 0 end)::bigint              as due_xaf,
    sum(case when c.payout_id is not null and p.status is distinct from 'paid'
             then c.amount_xaf else 0 end)::bigint              as pending_xaf,
    sum(case when p.status = 'paid'
             then c.amount_xaf else 0 end)::bigint              as paid_xaf
  from spot.commissions c
  left join spot.payouts p on p.id = c.payout_id
  group by c.creator_link_id, c.creator_id, c.campaign_id;

-- ── Billets vendus, par lien ────────────────────────────────────────
-- Même défaut, même correction : le décompte lisait toutes les commandes
-- payées attribuées, avec leurs lignes, pour n'en tirer qu'un total.
-- Réservé de fait à l'organisateur — seul orders_select_event_owner
-- ouvre les commandes d'un événement ; un acheteur n'y verra jamais que
-- les siennes, ce qui était déjà vrai.
create view spot.ticket_totals_by_link
with (security_invoker = true) as
  select
    o.creator_link_id,
    sum(i.quantity)::bigint as tickets
  from spot.orders o
  join spot.order_items i on i.order_id = o.id
  where o.status = 'paid'
    and o.creator_link_id is not null
  group by o.creator_link_id;

-- ── Versements récents, par campagne ────────────────────────────────
-- Celle-ci ne groupe rien : la page liste les versements un par un, il
-- n'y a pas de somme à faire descendre. Le problème est l'autre : la
-- liste n'avait pas de borne, et le plafond de PostgREST l'aurait
-- rognée par le haut, toutes campagnes confondues — une campagne
-- bavarde faisant disparaître l'historique des autres.
--
-- La borne est donc posée PAR CAMPAGNE, pour que chacune garde le sien.
-- 20 est un choix d'affichage, pas une règle métier : l'écran n'a pas de
-- pagination, c'est ce qui tient sous les yeux. Le jour où il en aura
-- une, cette vue disparaîtra au profit d'un range.
--
-- Colonnes choisies une par une : phone, channel, provider et
-- provider_ref restent en dehors: l'écran ne les montre pas, et la
-- destination d'un versement ne regarde pas l'organisateur.
create view spot.recent_payouts_by_campaign
with (security_invoker = true) as
  select id, reference, campaign_id, creator_id, amount_xaf,
         status, created_at, paid_at, failure_note
  from (
    select p.*,
           row_number() over (partition by p.campaign_id
                              order by p.created_at desc, p.id) as rang
    from spot.payouts p
  ) classe
  where rang <= 20;

-- Lecture seule, et jamais pour anon : ces vues ne parlent que d'argent
-- entre gens identifiés.
grant select on spot.commission_totals_by_link  to authenticated;
grant select on spot.ticket_totals_by_link      to authenticated;
grant select on spot.recent_payouts_by_campaign to authenticated;

grant select on spot.commission_totals_by_link  to service_role;
grant select on spot.ticket_totals_by_link      to service_role;
grant select on spot.recent_payouts_by_campaign to service_role;
