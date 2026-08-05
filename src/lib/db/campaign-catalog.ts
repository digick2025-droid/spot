import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import type {
  CampaignEvent,
  CampaignStatus,
  CommissionKind,
} from "./affiliation";

/**
 * Le catalogue des campagnes ouvertes.
 *
 * Lecture sous l'identité du creator : la policy campaigns_select_open
 * ne laisse passer que les campagnes actives qu'un organisateur a
 * marquées ouvertes, sur un événement publié. Une campagne fermée reste
 * donc invisible ici — elle ne se rejoint que par son lien d'invitation,
 * comme avant.
 *
 * Ouvrir une campagne ne donne aucun droit d'écriture supplémentaire :
 * l'adhésion emprunte exactement le même chemin que l'invitation
 * (joinCampaign), qui refait ses propres vérifications.
 */

export type CatalogCampaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  commissionKind: CommissionKind;
  commissionValue: number;
  event: CampaignEvent;
  organizerName: string;
  organizerSlug: string;
  /** Vrai quand le creator courant y a déjà son lien. */
  alreadyJoined: boolean;
  /** Vrai quand l'événement lui appartient : on ne se commissionne pas soi-même. */
  isMine: boolean;
};

type CatalogRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  commission_kind: CommissionKind;
  commission_value: number;
  events: (CampaignEvent & {
    organizers: { name: string; slug: string; owner_id: string };
  }) | null;
};

/**
 * Campagnes ouvertes, la plus récente d'abord.
 *
 * Les événements déjà passés sont écartés ici plutôt qu'en base : la
 * policy ne connaît pas l'heure de la requête, et promouvoir une soirée
 * finie ne rapporte rien à personne.
 */
export async function listOpenCampaigns(): Promise<CatalogCampaign[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `id, name, status, commission_kind, commission_value,
       events!inner (
         id, slug, title, glyph, gradient, city, starts_at,
         organizers!inner ( name, slug, owner_id )
       )`
    )
    .eq("open_to_creators", true)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60)
    .overrideTypes<CatalogRow[], { merge: false }>();

  if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);

  const rows = (data ?? []).filter(
    (row): row is CatalogRow & { events: NonNullable<CatalogRow["events"]> } =>
      row.events !== null
  );
  if (rows.length === 0) return [];

  // Ce que le creator a déjà rejoint : creator_links_select_own borne la
  // lecture à ses propres liens, le filtre est là pour la lisibilité.
  const { data: links, error: linkError } = await supabase
    .from("creator_links")
    .select("campaign_id")
    .eq("creator_id", user.id)
    .overrideTypes<{ campaign_id: string }[], { merge: false }>();

  if (linkError) throw new Error(`Lecture des liens impossible : ${linkError.message}`);

  const joined = new Set((links ?? []).map((link) => link.campaign_id));
  const now = Date.now();

  return rows
    .filter((row) => new Date(row.events.starts_at).getTime() >= now)
    .map((row) => {
      const { organizers, ...event } = row.events;
      return {
        id: row.id,
        name: row.name,
        status: row.status,
        commissionKind: row.commission_kind,
        commissionValue: row.commission_value,
        event,
        organizerName: organizers.name,
        organizerSlug: organizers.slug,
        alreadyJoined: joined.has(row.id),
        isMine: organizers.owner_id === user.id,
      };
    });
}
