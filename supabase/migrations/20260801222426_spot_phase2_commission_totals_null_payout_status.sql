-- ════════════════════════════════════════════════════════════════════
-- SPOT — Phase 2 : trace d'une correction déjà repliée en amont
--
-- Cette migration n'ajoute rien. Elle existe pour que l'historique du
-- dépôt et celui de la base racontent la même suite d'étapes.
--
-- Ce qui s'est passé : la vue commission_totals_by_link a d'abord été
-- appliquée avec « p.status <> 'paid' » pour le en-cours. Quand la
-- jointure sur payouts ne ramène rien, status vaut NULL, et
-- « NULL <> 'paid' » vaut NULL, donc faux : la part sortait des trois
-- colonnes de détail tout en restant dans total_xaf. De l'argent visible
-- dans un total, introuvable dans son détail. « is distinct from » a
-- corrigé ça, par le create or replace ci-dessous.
--
-- Le fichier 20260801222038 porte déjà la version corrigée : il a été
-- écrit après coup, une fois le défaut compris. Rejouer le dossier sur
-- une base neuve donne donc la bonne vue dès l'étape précédente, et ce
-- replace la redéfinit à l'identique — inoffensif, et idempotent.
--
-- À supprimer si l'historique est un jour reparti de zéro.
-- ════════════════════════════════════════════════════════════════════

create or replace view spot.commission_totals_by_link
with (security_invoker = true) as
  select
    c.creator_link_id,
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
