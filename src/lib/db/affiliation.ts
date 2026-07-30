import "server-only";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
  code: string;
  /** Nom public du creator, ou son code de lien à défaut. */
  name: string;
  clicks: number;
  tickets: number;
  commissionXaf: number;
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
  creators: CampaignCreator[];
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
};

export type CreatorSpace = {
  campaigns: CreatorCampaign[];
  totalEarningsXaf: number;
  totalClicks: number;
  totalSales: number;
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

type CommissionRow = { creator_link_id: string; amount_xaf: number };

/** Billets d'une commande attribuée : la commission porte sur la commande. */
type AttributedOrderRow = {
  creator_link_id: string | null;
  order_items: { quantity: number }[];
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

  const [commissions, orders, names] = await Promise.all([
    readCommissionsByLink(),
    readTicketsByLink(),
    readCreatorNames(campaignRows.flatMap((c) => c.creator_links.map((l) => l.creator_id))),
  ]);

  return campaignRows
    // Un événement passé en brouillon sort de la RLS : sa campagne n'a
    // plus rien à afficher.
    .filter((row): row is CampaignRow & { events: CampaignEvent } => row.events !== null)
    .map((row) => {
      const creators = row.creator_links.map((link) => ({
        linkId: link.id,
        code: link.code,
        name: names.get(link.creator_id) ?? link.code,
        clicks: link.clicks,
        tickets: orders.get(link.id) ?? 0,
        commissionXaf: commissions.get(link.id)?.amount ?? 0,
      }));

      return {
        id: row.id,
        name: row.name,
        status: row.status,
        commissionKind: row.commission_kind,
        commissionValue: row.commission_value,
        event: row.events,
        clicks: creators.reduce((n, c) => n + c.clicks, 0),
        tickets: creators.reduce((n, c) => n + c.tickets, 0),
        commissionXaf: creators.reduce((n, c) => n + c.commissionXaf, 0),
        creators: creators.sort((a, b) => b.commissionXaf - a.commissionXaf),
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

/** Espace Creator de l'utilisateur courant. */
export async function getCreatorSpace(): Promise<CreatorSpace> {
  const supabase = await createClient();

  const [linksResult, commissions] = await Promise.all([
    supabase
      .from("creator_links")
      .select(
        `id, code, clicks,
         campaigns!inner (
           id, name, status, commission_kind, commission_value,
           events!inner ( id, slug, title, glyph, gradient, city, starts_at )
         )`
      )
      .order("created_at", { ascending: false })
      .overrideTypes<LinkRow[], { merge: false }>(),
    readCommissionsByLink(),
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

    const totals = commissions.get(link.id);
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
      sales: totals?.count ?? 0,
      earningsXaf: totals?.amount ?? 0,
    });
  }

  return {
    campaigns,
    totalEarningsXaf: campaigns.reduce((n, c) => n + c.earningsXaf, 0),
    totalClicks: campaigns.reduce((n, c) => n + c.clicks, 0),
    totalSales: campaigns.reduce((n, c) => n + c.sales, 0),
  };
}

/**
 * Commissions visibles par l'appelant, regroupées par lien.
 *
 * La RLS peut renvoyer à la fois celles qu'il a gagnées et celles qu'il
 * doit ; les appelants n'en retiennent que les liens qui les concernent.
 */
async function readCommissionsByLink(): Promise<
  Map<string, { amount: number; count: number }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commissions")
    .select("creator_link_id, amount_xaf")
    .overrideTypes<CommissionRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des commissions impossible : ${error.message}`);

  const byLink = new Map<string, { amount: number; count: number }>();
  for (const row of data ?? []) {
    const current = byLink.get(row.creator_link_id) ?? { amount: 0, count: 0 };
    byLink.set(row.creator_link_id, {
      amount: current.amount + row.amount_xaf,
      count: current.count + 1,
    });
  }
  return byLink;
}

/** Billets payés par lien — réservé à l'organisateur, seul à lire orders. */
async function readTicketsByLink(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("creator_link_id, order_items ( quantity )")
    .eq("status", "paid")
    .not("creator_link_id", "is", null)
    .overrideTypes<AttributedOrderRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des ventes impossible : ${error.message}`);

  const byLink = new Map<string, number>();
  for (const order of data ?? []) {
    if (!order.creator_link_id) continue;
    const quantity = order.order_items.reduce((n, item) => n + item.quantity, 0);
    byLink.set(order.creator_link_id, (byLink.get(order.creator_link_id) ?? 0) + quantity);
  }
  return byLink;
}

/**
 * Noms publics des creators d'une campagne.
 *
 * profiles_select_own réserve la table à son propriétaire : l'organisateur
 * ne peut pas lire ces lignes sous sa propre identité. On passe donc en
 * service_role, en n'exposant que le nom public — pas l'e-mail ni le
 * téléphone — et seulement pour des personnes qui ont rejoint une de ses
 * campagnes.
 */
async function readCreatorNames(creatorIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(creatorIds)];
  if (unique.length === 0) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", unique)
    .overrideTypes<{ id: string; full_name: string | null }[], { merge: false }>();

  if (error) throw new Error(`Lecture des creators impossible : ${error.message}`);

  const names = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.full_name) names.set(row.id, row.full_name);
  }
  return names;
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
