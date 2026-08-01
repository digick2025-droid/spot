"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PaymentError,
  getPaymentProvider,
  normalizeCameroonPhone,
  operatorFromPhone,
} from "@/lib/payments";
import type { PayoutFailureCode, PayoutFormState } from "./payout-state";

/**
 * Versement des commissions — écritures.
 *
 * Deux gestes seulement, et ils n'appartiennent pas à la même personne :
 *
 *  - le creator désigne le numéro sur lequel il veut être payé ;
 *  - l'organisateur ordonne le versement de ce qu'il doit.
 *
 * Tout le reste appartient au serveur. Le montant n'est jamais transmis
 * par le formulaire : spot.open_payout le recalcule depuis les
 * commissions encore dues, sous verrou. Un client qui rejouerait la
 * requête ne peut donc ni choisir la somme, ni la payer deux fois.
 */

const phoneSchema = z.object({ phone: z.string().trim().max(20) });

/**
 * Enregistre (ou efface) le numéro Mobile Money du creator courant.
 *
 * profiles_update_own suffit ici : chacun n'écrit que sur sa ligne, et
 * le numéro est normalisé au même format que partout ailleurs pour que
 * l'agrégateur reçoive toujours la même forme.
 */
export async function updatePayoutPhone(
  _state: PayoutFormState,
  formData: FormData
): Promise<PayoutFormState> {
  const t = await getTranslations("affiliation");
  const profile = await requireProfile();

  const parsed = phoneSchema.safeParse({ phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { error: t("errors.invalidPhone") };

  let phone: string | null = null;
  if (parsed.data.phone !== "") {
    try {
      phone = normalizeCameroonPhone(parsed.data.phone);
    } catch (error) {
      if (error instanceof PaymentError) return { error: t("errors.invalidPhone") };
      throw error;
    }

    // Un numéro dont on ne déduit pas l'opérateur ne peut pas être
    // adressé : autant le refuser ici plutôt qu'au moment du virement.
    if (!operatorFromPhone(phone)) return { error: t("errors.unknownOperator") };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ payout_phone: phone })
    .eq("id", profile.id);

  if (error) {
    console.error("[versement] enregistrement du numéro échoué", error);
    return { error: t("errors.unavailable") };
  }

  refresh();
  return { notice: phone ? t("payoutPhoneSaved") : t("payoutPhoneCleared") };
}

/** Référence lisible d'un versement, ex. SPOTP-7K3F9Q. */
function newPayoutReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `SPOTP-${out}`;
}

const paySchema = z.object({
  campaignId: z.uuid(),
  creatorId: z.uuid(),
});

type OpenedPayout = {
  o_payout_id: string;
  o_total_xaf: number;
  o_lines: number;
};

/**
 * Ordonne le versement de tout ce qui est dû à un creator sur une
 * campagne.
 *
 * L'ordre des opérations est celui du tunnel d'achat, à l'envers : on
 * inscrit d'abord l'engagement en base (open_payout rattache les
 * commissions), on sollicite l'agrégateur ensuite. Si l'appel échoue,
 * fail_payout rend les commissions au dû — mieux vaut une somme à
 * reverser deux fois qu'un creator payé deux fois.
 *
 * Le versement naît « pending » et le reste : seul le webhook signé le
 * confirme, exactement comme une commande.
 */
export async function payCreator(
  _state: PayoutFormState,
  formData: FormData
): Promise<PayoutFormState> {
  const t = await getTranslations("affiliation");
  const profile = await requireProfile();

  const parsed = paySchema.safeParse({
    campaignId: formData.get("campaignId"),
    creatorId: formData.get("creatorId"),
  });
  if (!parsed.success) return { error: t("errors.invalidCampaign") };

  const admin = createAdminClient();

  // Vérification d'appartenance explicite : la suite se déroule en
  // service_role, qui ignore la RLS.
  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .select("id, name, events!inner ( title, organizers!inner ( owner_id ) )")
    .eq("id", parsed.data.campaignId)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        name: string;
        events: { title: string; organizers: { owner_id: string } };
      } | null,
      { merge: false }
    >();

  if (campaignError) {
    console.error("[versement] lecture de campagne échouée", campaignError);
    return { error: t("errors.unavailable") };
  }
  if (!campaign) return { error: t("errors.campaignNotFound") };
  if (campaign.events.organizers.owner_id !== profile.id) {
    return { error: t("errors.notOwner") };
  }

  // Destination : celle que le creator a désignée, jamais une saisie de
  // l'organisateur.
  const { data: creator } = await admin
    .from("profiles")
    .select("payout_phone")
    .eq("id", parsed.data.creatorId)
    .maybeSingle();

  const rawPhone = (creator?.payout_phone as string | null | undefined) ?? null;
  if (!rawPhone) return { error: t("errors.noPayoutPhone") };

  let phone: string;
  try {
    phone = normalizeCameroonPhone(rawPhone);
  } catch {
    return { error: t("errors.noPayoutPhone") };
  }

  const channel = operatorFromPhone(phone);
  if (!channel) return { error: t("errors.unknownOperator") };

  const reference = newPayoutReference();

  const { data: opened, error: openError } = await admin.rpc("open_payout", {
    p_campaign_id: parsed.data.campaignId,
    p_creator_id: parsed.data.creatorId,
    p_reference: reference,
    p_phone: phone,
    p_channel: channel,
  });

  if (openError) {
    console.error("[versement] ouverture échouée", openError);
    return { error: t("errors.unavailable") };
  }

  const payout = (opened as OpenedPayout[] | null)?.[0];
  // Aucune commission à rattacher : rien n'est dû, ou un autre versement
  // vient de tout emporter.
  if (!payout) return { error: t("errors.nothingDue") };

  const provider = getPaymentProvider();
  try {
    const disbursement = await provider.disburse({
      amountXaf: payout.o_total_xaf,
      phone,
      channel,
      reference,
      description: `SPOT — commission ${campaign.events.title}`,
    });

    await admin
      .from("payouts")
      .update({ provider: provider.name, provider_ref: disbursement.providerRef })
      .eq("id", payout.o_payout_id);
  } catch (error) {
    // La note part sous les yeux du creator : elle dit ce qui s'est
    // passé, pas ce que l'agrégateur en a écrit. Le message d'origine
    // est juste au-dessus, dans les journaux.
    console.error("[versement] demande de reversement échouée", error);

    const { error: failError } = await admin.rpc("fail_payout", {
      p_payout_id: payout.o_payout_id,
      p_note: "request_failed" satisfies PayoutFailureCode,
    });
    if (failError) {
      // Les commissions restent rattachées à un versement qui n'est
      // jamais parti : elles n'apparaîtront plus comme dues tant que ce
      // n'est pas repris à la main. On le crie dans les journaux.
      console.error(
        `[versement] ${payout.o_payout_id} bloqué en attente : ${failError.message}`
      );
    }

    refresh();
    return { error: t("errors.payoutFailed") };
  }

  refresh();
  return {
    notice: t("payoutSent", { count: payout.o_lines }),
  };
}
