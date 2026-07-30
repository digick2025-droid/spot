"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AffiliationFormState } from "./affiliation-state";

/**
 * Affiliation creators — écritures.
 *
 * L'organisateur écrit ses campagnes sous sa propre identité : les
 * policies campaigns_rw_owner et creator_links_rw_owner vérifient qu'il
 * possède bien l'événement, il n'y a rien à faire en service_role.
 *
 * L'adhésion d'un creator, elle, y passe : creator_links n'accorde aucun
 * droit d'insertion à l'intéressé, précisément pour qu'il ne puisse pas
 * s'auto-inscrire à une campagne au hasard. Les vérifications que la RLS
 * ferait sont alors faites ici, explicitement.
 */

const campaignSchema = z.object({
  eventId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["percent", "fixed"]),
  value: z.coerce.number().int().min(0).max(10_000_000),
});

/** Ouvre une campagne sur un événement de l'organisateur courant. */
export async function createCampaign(
  _state: AffiliationFormState,
  formData: FormData
): Promise<AffiliationFormState> {
  const t = await getTranslations("affiliation");
  await requireProfile();

  const parsed = campaignSchema.safeParse({
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: t("errors.invalidCampaign") };

  // La contrainte campaigns_percent_max dirait la même chose, mais en
  // erreur Postgres : autant le dire dans la langue de l'organisateur.
  if (parsed.data.kind === "percent" && parsed.data.value > 100) {
    return { error: t("errors.percentTooHigh") };
  }
  if (parsed.data.value === 0) return { error: t("errors.zeroCommission") };

  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").insert({
    event_id: parsed.data.eventId,
    name: parsed.data.name,
    commission_kind: parsed.data.kind,
    commission_value: parsed.data.value,
  });

  if (error) {
    console.error("[affiliation] création de campagne échouée", error);
    return { error: t("errors.unavailable") };
  }

  refresh();
  return {};
}

const statusSchema = z.object({
  campaignId: z.uuid(),
  status: z.enum(["active", "paused", "ended"]),
});

/**
 * Met une campagne en pause, la relance ou la clôt.
 *
 * Les commissions déjà dues ne bougent pas : elles ont été figées à
 * l'encaissement. Seules les commandes à venir cessent d'en produire.
 */
export async function setCampaignStatus(formData: FormData) {
  await requireProfile();

  const parsed = statusSchema.safeParse({
    campaignId: formData.get("campaignId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.campaignId);

  if (error) throw new Error(`Mise à jour de la campagne impossible : ${error.message}`);

  refresh();
}

/** Alphabet sans caractères confondables : un code se lit à voix haute. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newLinkCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

const joinSchema = z.uuid();

/**
 * Fait entrer l'utilisateur courant dans une campagne, avec son lien.
 *
 * Trois refus explicites, parce que la RLS ne peut pas les porter ici :
 * la campagne doit être ouverte, l'organisateur ne peut pas se
 * commissionner sur son propre événement, et un creator n'a qu'un lien
 * par campagne (la contrainte d'unicité le garantit de toute façon).
 */
export async function joinCampaign(
  _state: AffiliationFormState,
  formData: FormData
): Promise<AffiliationFormState> {
  const t = await getTranslations("affiliation");
  const profile = await requireProfile();

  const parsed = joinSchema.safeParse(formData.get("campaignId"));
  if (!parsed.success) return { error: t("errors.invalidCampaign") };

  const admin = createAdminClient();

  const { data: campaign, error } = await admin
    .from("campaigns")
    .select("id, status, events!inner ( id, organizers!inner ( owner_id ) )")
    .eq("id", parsed.data)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        status: "active" | "paused" | "ended";
        events: { id: string; organizers: { owner_id: string } };
      } | null,
      { merge: false }
    >();

  if (error) {
    console.error("[affiliation] lecture de campagne échouée", error);
    return { error: t("errors.unavailable") };
  }
  if (!campaign) return { error: t("errors.campaignNotFound") };
  if (campaign.status !== "active") return { error: t("errors.campaignClosed") };
  if (campaign.events.organizers.owner_id === profile.id) {
    return { error: t("errors.ownEvent") };
  }

  const { data: existing } = await admin
    .from("creator_links")
    .select("id")
    .eq("campaign_id", campaign.id)
    .eq("creator_id", profile.id)
    .maybeSingle();

  if (!existing) {
    // Trois essais : une collision sur 32^8 codes est déjà improbable,
    // deux d'affilée relèvent de l'anomalie.
    let inserted = false;
    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      const { error: insertError } = await admin.from("creator_links").insert({
        campaign_id: campaign.id,
        creator_id: profile.id,
        code: newLinkCode(),
      });

      if (!insertError) {
        inserted = true;
      } else if (insertError.code === "23505") {
        // Unicité : soit le code, soit (campagne, creator) si deux envois
        // se sont croisés. Dans le second cas le lien existe, c'est gagné.
        const { data: raced } = await admin
          .from("creator_links")
          .select("id")
          .eq("campaign_id", campaign.id)
          .eq("creator_id", profile.id)
          .maybeSingle();
        if (raced) inserted = true;
      } else {
        console.error("[affiliation] création du lien échouée", insertError);
        return { error: t("errors.unavailable") };
      }
    }

    if (!inserted) return { error: t("errors.unavailable") };
  }

  const locale = await getLocale();
  return redirect({ href: "/creator", locale });
}
