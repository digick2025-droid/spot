import "server-only";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth/dal";
import { getMyOrganizer } from "./organizer";

/**
 * Affiliation creators — lectures.
 *
 * Deux points de vue sur les mêmes tables :
 *  - l'organisateur suit ses campagnes et ce qu'il doit à chaque creator ;
 *  - le creator suit ses liens et ce qu'il a gagné.
 *
 * La RLS fait le tri (campaigns_rw_owner, creator_links_select_own,
 * commissions_select_own / _owner) : les requêtes ci-dessous ne
 * répètent un filtre que lorsqu'il change réellement le résultat.
 */

/** Cookie d'attribution posé par /r/[code]. */
export const REF_COOKIE = "spot_ref";

/** Un mois : au-delà, le lien n'a plus grand-chose à voir avec l'achat. */
export const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type CommissionKind = "percent" | "fixed";
export type CampaignStatus = "active" | "paused" | "ended";
export type PayoutStatus = "pending" | "paid" | "failed";

/**
 * Répartition d'un cumul de commissions selon l'avancement du versement.
 *
 * Une commission est « due » tant qu'aucun versement ne la porte, « en
 * cours » dès qu'un ordre est parti chez l'opérateur, et « versée »
 * quand celui-ci l'a confirmé. Un versement raté remet sa part au dû.
 */
export type CommissionTotals = {
  totalXaf: number;
  count: number;
  dueXaf: number;
  pendingXaf: number;
  paidXaf: number;
};

const NO_COMMISSION: CommissionTotals = {
  totalXaf: 0,
  count: 0,
  dueXaf: 0,
  pendingXaf: 0,
  paidXaf: 0,
};

export type CampaignEvent = {
  id: string;
  slug: string;
  title: string;
  glyph: string | null;
  gradient: string | null;
  city: string;
  starts_at: string;
};

export type CampaignCreator = {
  linkId: string;
  /** Destinataire du versement — l'ordre de paiement le désigne, pas le lien. */
  creatorId: string;
  code: string;
  /** Nom public du creator, ou son code de lien à défaut. */
  name: string;
  clicks: number;
  tickets: number;
  commissionXaf: number;
  dueXaf: number;
  pendingXaf: number;
  paidXaf: number;
  /**
   * Vrai quand le creator a désigné un numéro de versement. Le numéro
   * lui-même ne remonte pas : l'organisateur ordonne le paiement, il n'a
   * pas à connaître la destination.
   */
  hasPayoutPhone: boolean;
};

/** Un ordre de versement, vu par l'organisateur qui l'a déclenché. */
export type OrganizerPayout = {
  id: string;
  reference: string;
  creatorName: string;
  amountXaf: number;
  status: PayoutStatus;
  createdAt: string;
  paidAt: string | null;
  failureNote: string | null;
};

export type OrganizerCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  commissionKind: CommissionKind;
  commissionValue: number;
  event: CampaignEvent;
  clicks: number;
  tickets: number;
  commissionXaf: number;
  dueXaf: number;
  pendingXaf: number;
  paidXaf: number;
  creators: CampaignCreator[];
  payouts: OrganizerPayout[];
};

export type CreatorCampaign = {
  linkId: string;
  code: string;
  clicks: number;
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  commissionKind: CommissionKind;
  commissionValue: number;
  event: CampaignEvent;
  /** Commandes payées arrivées par le lien — une commission par commande. */
  sales: number;
  earningsXaf: number;
  dueXaf: number;
  pendingXaf: number;
  paidXaf: number;
};

/** Un ordre de versement, vu par le creator qui l'attend. */
export type CreatorPayout = {
  id: string;
  reference: string;
  amountXaf: number;
  status: PayoutStatus;
  createdAt: string;
  paidAt: string | null;
  campaignName: string;
  eventTitle: string;
};

export type CreatorSpace = {
  campaigns: CreatorCampaign[];
  totalEarningsXaf: number;
  totalClicks: number;
  totalSales: number;
  totalDueXaf: number;
  totalPendingXaf: number;
  totalPaidXaf: number;
  /** Numéro Mobile Money sur lequel le creator veut être payé. */
  payoutPhone: string | null;
  payouts: CreatorPayout[];
};

const EMPTY_CREATOR_SPACE: CreatorSpace = {
  campaigns: [],
  totalEarningsXaf: 0,
  totalClicks: 0,
  totalSales: 0,
  totalDueXaf: 0,
  totalPendingXaf: 0,
  totalPaidXaf: 0,
  payoutPhone: null,
  payouts: [],
};

type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  commission_kind: CommissionKind;
  commission_value: number;
  events: CampaignEvent | null;
  creator_links: {
    id: string;
    code: string;
    clicks: number;
    creator_id: string;
  }[];
};

/** Une ligne de spot.commission_totals_by_link : un lien, ses cumuls. */
type CommissionTotalsRow = {
  creator_link_id: string;
  commission_count: number;
  total_xaf: number;
  due_xaf: number;
  pending_xaf: number;
  paid_xaf: number;
};

/** Une ligne de spot.ticket_totals_by_link. */
type TicketTotalsRow = {
  creator_link_id: string;
  tickets: number;
};

/**
 * Campagnes de l'organisateur courant, avec leurs creators et les cumuls.
 *
 * Les billets vendus se lisent sur les commandes payées portant le lien :
 * l'organisateur y a accès (orders_select_event_owner), le creator non —
 * d'où le décompte différent des deux côtés.
 */
export async function getOrganizerCampaigns(): Promise<OrganizerCampaign[] | null> {
  const organizer = await getMyOrganizer();
  if (!organizer) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `id, name, status, commission_kind, commission_value,
       events!inner ( id, slug, title, glyph, gradient, city, starts_at, organizer_id ),
       creator_links ( id, code, clicks, creator_id )`
    )
    .eq("events.organizer_id", organizer.id)
    .order("created_at", { ascending: false })
    .overrideTypes<CampaignRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des campagnes impossible : ${error.message}`);

  const campaignRows = data ?? [];
  if (campaignRows.length === 0) return [];

  const campaignIds = campaignRows.map((c) => c.id);
  const linkIds = campaignRows.flatMap((c) => c.creator_links.map((l) => l.id));

  const [commissions, orders, creators, payouts] = await Promise.all([
    readCommissionsByLink({ campaignIds }),
    readTicketsByLink(linkIds),
    readCreatorProfiles(
      campaignRows.flatMap((c) => c.creator_links.map((l) => l.creator_id))
    ),
    readPayoutsByCampaign(campaignIds),
  ]);

  return campaignRows
    // Un événement passé en brouillon sort de la RLS : sa campagne n'a
    // plus rien à afficher.
    .filter((row): row is CampaignRow & { events: CampaignEvent } => row.events !== null)
    .map((row) => {
      const links = row.creator_links.map((link) => {
        const totals = commissions.get(link.id) ?? NO_COMMISSION;
        const profile = creators.get(link.creator_id);

        return {
          linkId: link.id,
          creatorId: link.creator_id,
          code: link.code,
          name: profile?.name ?? link.code,
          clicks: link.clicks,
          tickets: orders.get(link.id) ?? 0,
          commissionXaf: totals.totalXaf,
          dueXaf: totals.dueXaf,
          pendingXaf: totals.pendingXaf,
          paidXaf: totals.paidXaf,
          hasPayoutPhone: profile?.hasPayoutPhone ?? false,
        };
      });

      return {
        id: row.id,
        name: row.name,
        status: row.status,
        commissionKind: row.commission_kind,
        commissionValue: row.commission_value,
        event: row.events,
        clicks: links.reduce((n, c) => n + c.clicks, 0),
        tickets: links.reduce((n, c) => n + c.tickets, 0),
        commissionXaf: links.reduce((n, c) => n + c.commissionXaf, 0),
        dueXaf: links.reduce((n, c) => n + c.dueXaf, 0),
        pendingXaf: links.reduce((n, c) => n + c.pendingXaf, 0),
        paidXaf: links.reduce((n, c) => n + c.paidXaf, 0),
        // Ce qui reste à payer d'abord : c'est la seule ligne sur
        // laquelle l'organisateur a quelque chose à faire.
        creators: links.sort((a, b) => b.dueXaf - a.dueXaf || b.commissionXaf - a.commissionXaf),
        payouts: (payouts.get(row.id) ?? []).map(({ creatorId, ...payout }) => ({
          ...payout,
          creatorName: creators.get(creatorId)?.name ?? "—",
        })),
      };
    });
}

type LinkRow = {
  id: string;
  code: string;
  clicks: number;
  campaigns: {
    id: string;
    name: string;
    status: CampaignStatus;
    commission_kind: CommissionKind;
    commission_value: number;
    events: CampaignEvent | null;
  } | null;
};

/**
 * Espace Creator de l'utilisateur courant.
 *
 * Même précaution que dans readMyPayouts, et pour la même raison :
 * creator_links_rw_owner ouvre aussi la table aux liens des creators
 * qu'un organisateur a invités. Sans le filtre sur creator_id, il verrait
 * ici les liens de promo des autres présentés comme les siens — code
 * compris — et leurs gains comptés dans ses totaux.
 */
export async function getCreatorSpace(): Promise<CreatorSpace> {
  const user = await getUser();
  if (!user) return EMPTY_CREATOR_SPACE;

  const supabase = await createClient();

  const [linksResult, commissions, payouts, payoutPhone] = await Promise.all([
    supabase
      .from("creator_links")
      .select(
        `id, code, clicks,
         campaigns!inner (
           id, name, status, commission_kind, commission_value,
           events!inner ( id, slug, title, glyph, gradient, city, starts_at )
         )`
      )
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<LinkRow[], { merge: false }>(),
    readCommissionsByLink({ creatorId: user.id }),
    readMyPayouts(),
    readMyPayoutPhone(),
  ]);

  if (linksResult.error) {
    throw new Error(`Lecture des liens impossible : ${linksResult.error.message}`);
  }

  const campaigns: CreatorCampaign[] = [];
  for (const link of linksResult.data ?? []) {
    const campaign = link.campaigns;
    // Événement dépublié : le lien survit en base, mais il n'y a plus de
    // page à promouvoir.
    if (!campaign?.events) continue;

    const totals = commissions.get(link.id) ?? NO_COMMISSION;
    campaigns.push({
      linkId: link.id,
      code: link.code,
      clicks: link.clicks,
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      commissionKind: campaign.commission_kind,
      commissionValue: campaign.commission_value,
      event: campaign.events,
      sales: totals.count,
      earningsXaf: totals.totalXaf,
      dueXaf: totals.dueXaf,
      pendingXaf: totals.pendingXaf,
      paidXaf: totals.paidXaf,
    });
  }

  return {
    campaigns,
    totalEarningsXaf: campaigns.reduce((n, c) => n + c.earningsXaf, 0),
    totalClicks: campaigns.reduce((n, c) => n + c.clicks, 0),
    totalSales: campaigns.reduce((n, c) => n + c.sales, 0),
    totalDueXaf: campaigns.reduce((n, c) => n + c.dueXaf, 0),
    totalPendingXaf: campaigns.reduce((n, c) => n + c.pendingXaf, 0),
    totalPaidXaf: campaigns.reduce((n, c) => n + c.paidXaf, 0),
    payoutPhone,
    payouts,
  };
}

type PayoutRow = {
  id: string;
  reference: string;
  amount_xaf: number;
  status: PayoutStatus;
  created_at: string;
  paid_at: string | null;
  campaigns: { name: string; events: { title: string } | null } | null;
};

/**
 * Versements reçus (ou en route) par l'utilisateur courant.
 *
 * Le filtre sur creator_id n'est pas décoratif : payouts_select_owner
 * ouvre aussi la table aux versements que l'organisateur DOIT. Sans lui,
 * un creator également organisateur verrait ses propres ordres de
 * paiement listés comme des gains.
 */
async function readMyPayouts(): Promise<CreatorPayout[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payouts")
    .select(
      `id, reference, amount_xaf, status, created_at, paid_at,
       campaigns ( name, events ( title ) )`
    )
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false })
    .overrideTypes<PayoutRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des versements impossible : ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    reference: row.reference,
    amountXaf: row.amount_xaf,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    campaignName: row.campaigns?.name ?? "—",
    eventTitle: row.campaigns?.events?.title ?? "—",
  }));
}

/** Numéro de versement du creator courant, s'il en a désigné un. */
async function readMyPayoutPhone(): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("payout_phone")
    .eq("id", user.id)
    .maybeSingle()
    .overrideTypes<{ payout_phone: string | null } | null, { merge: false }>();

  if (error) throw new Error(`Lecture du profil impossible : ${error.message}`);
  return data?.payout_phone ?? null;
}

/**
 * De quel côté on regarde les commissions.
 *
 * Les deux appelants savent déjà ce qui les concerne : autant le dire à
 * la requête. La RLS reste le garde-fou, mais elle ne suffit pas à
 * cadrer une lecture — commissions_select_own et _owner se cumulent en
 * OR, et quelqu'un qui est à la fois creator et organisateur voit les
 * deux ensembles.
 */
type CommissionScope = { campaignIds: string[] } | { creatorId: string };

/**
 * Cumuls de commissions par lien.
 *
 * La somme est faite par Postgres (spot.commission_totals_by_link) : une
 * ligne par lien, quel qu'ait été le nombre de ventes. La boucle qui
 * tenait ici additionnait « select * from commissions », que PostgREST
 * tronque à 1000 lignes sans le dire — passé ce seuil, les gains d'un
 * creator se seraient mis à baisser tout seuls.
 */
async function readCommissionsByLink(
  scope: CommissionScope
): Promise<Map<string, CommissionTotals>> {
  const supabase = await createClient();

  const query = supabase
    .from("commission_totals_by_link")
    .select(
      "creator_link_id, commission_count, total_xaf, due_xaf, pending_xaf, paid_xaf"
    );

  const { data, error } = await ("creatorId" in scope
    ? query.eq("creator_id", scope.creatorId)
    : query.in("campaign_id", scope.campaignIds)
  ).overrideTypes<CommissionTotalsRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des commissions impossible : ${error.message}`);

  const byLink = new Map<string, CommissionTotals>();
  for (const row of data ?? []) {
    byLink.set(row.creator_link_id, {
      totalXaf: row.total_xaf,
      count: row.commission_count,
      dueXaf: row.due_xaf,
      pendingXaf: row.pending_xaf,
      paidXaf: row.paid_xaf,
    });
  }
  return byLink;
}

type OrganizerPayoutRow = {
  id: string;
  reference: string;
  campaign_id: string;
  creator_id: string;
  amount_xaf: number;
  status: PayoutStatus;
  created_at: string;
  paid_at: string | null;
  failure_note: string | null;
};

/**
 * Versements ordonnés par l'organisateur, regroupés par campagne.
 *
 * Une liste, pas un cumul : rien à sommer, mais rien qui la bornait non
 * plus. spot.recent_payouts_by_campaign en garde les 20 derniers PAR
 * campagne — sans cela, le plafond de PostgREST aurait rogné l'ensemble
 * par le haut, et une campagne bavarde aurait effacé l'historique des
 * autres. La lecture est en outre restreinte aux campagnes affichées :
 * celles reçues en tant que creator ne remontent plus pour être jetées
 * ensuite.
 */
async function readPayoutsByCampaign(
  campaignIds: string[]
): Promise<Map<string, (OrganizerPayout & { creatorId: string })[]>> {
  if (campaignIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recent_payouts_by_campaign")
    .select(
      "id, reference, campaign_id, creator_id, amount_xaf, status, created_at, paid_at, failure_note"
    )
    .in("campaign_id", campaignIds)
    .order("created_at", { ascending: false })
    .overrideTypes<OrganizerPayoutRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des versements impossible : ${error.message}`);

  const byCampaign = new Map<string, (OrganizerPayout & { creatorId: string })[]>();
  for (const row of data ?? []) {
    const list = byCampaign.get(row.campaign_id) ?? [];
    list.push({
      id: row.id,
      reference: row.reference,
      creatorId: row.creator_id,
      creatorName: "",
      amountXaf: row.amount_xaf,
      status: row.status,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      failureNote: row.failure_note,
    });
    byCampaign.set(row.campaign_id, list);
  }
  return byCampaign;
}

/**
 * Billets payés par lien — réservé à l'organisateur, seul à lire orders.
 *
 * Même bascule que pour les commissions : la somme des quantités se fait
 * en base, et la lecture est bornée aux liens effectivement affichés
 * plutôt qu'à toutes les commandes attribuées de la plateforme.
 */
async function readTicketsByLink(linkIds: string[]): Promise<Map<string, number>> {
  if (linkIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_totals_by_link")
    .select("creator_link_id, tickets")
    .in("creator_link_id", linkIds)
    .overrideTypes<TicketTotalsRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des ventes impossible : ${error.message}`);

  return new Map((data ?? []).map((row) => [row.creator_link_id, row.tickets]));
}

/**
 * Ce que l'organisateur a besoin de savoir des creators de ses campagnes.
 *
 * profiles_select_own réserve la table à son propriétaire : l'organisateur
 * ne peut pas lire ces lignes sous sa propre identité. On passe donc en
 * service_role, en n'exposant que le nom public — pas l'e-mail, pas le
 * téléphone, pas même le numéro de versement, dont seul le fait qu'il
 * existe sort d'ici — et seulement pour des personnes qui ont rejoint une
 * de ses campagnes.
 */
async function readCreatorProfiles(
  creatorIds: string[]
): Promise<Map<string, { name: string | null; hasPayoutPhone: boolean }>> {
  const unique = [...new Set(creatorIds)];
  if (unique.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, payout_phone")
    .in("id", unique)
    .overrideTypes<
      { id: string; full_name: string | null; payout_phone: string | null }[],
      { merge: false }
    >();

  if (error) throw new Error(`Lecture des creators impossible : ${error.message}`);

  const profiles = new Map<string, { name: string | null; hasPayoutPhone: boolean }>();
  for (const row of data ?? []) {
    profiles.set(row.id, {
      name: row.full_name,
      hasPayoutPhone: Boolean(row.payout_phone),
    });
  }
  return profiles;
}

export type JoinableCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  commissionKind: CommissionKind;
  commissionValue: number;
  event: CampaignEvent;
  /** Vrai quand l'utilisateur courant y a déjà son lien. */
  alreadyJoined: boolean;
};

/**
 * Campagne présentée à un creator invité.
 *
 * Lecture en service_role, à dessein : campaigns_select_creator exige un
 * lien existant, or c'est justement ce que la personne n'a pas encore.
 * L'identifiant de campagne tient donc lieu d'invitation — il n'est pas
 * devinable, et cette page ne révèle rien de plus que la page publique de
 * l'événement plus le taux proposé.
 */
export async function getJoinableCampaign(
  campaignId: string,
  userId: string
): Promise<JoinableCampaign | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("campaigns")
    .select(
      `id, name, status, commission_kind, commission_value,
       events!inner ( id, slug, title, glyph, gradient, city, starts_at )`
    )
    .eq("id", campaignId)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        name: string;
        status: CampaignStatus;
        commission_kind: CommissionKind;
        commission_value: number;
        events: CampaignEvent;
      } | null,
      { merge: false }
    >();

  if (error) throw new Error(`Lecture de la campagne impossible : ${error.message}`);
  if (!data) return null;

  const { data: link } = await admin
    .from("creator_links")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("creator_id", userId)
    .maybeSingle();

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    commissionKind: data.commission_kind,
    commissionValue: data.commission_value,
    event: data.events,
    alreadyJoined: link !== null,
  };
}

/** Code d'affiliation transporté par le cookie, s'il y en a un. */
export async function readRefCode(): Promise<string | null> {
  const store = await cookies();
  return store.get(REF_COOKIE)?.value ?? null;
}

/**
 * Origine publique du site, pour écrire un lien de promo copiable.
 *
 * Déduite des en-têtes de la requête plutôt que d'une variable
 * d'environnement : le lien reste juste en local, en préproduction et en
 * production sans configuration supplémentaire.
 */
export async function getSiteOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
