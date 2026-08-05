"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PaymentError,
  normalizeCameroonPhone,
  operatorFromPhone,
} from "@/lib/payments";
import type { WithdrawalFormState } from "./withdrawal-state";

/**
 * Demandes de retrait — écritures.
 *
 * Ce que le formulaire transmet : rien d'autre que l'intention. Ni le
 * montant, ni la destination. La somme est recalculée en base sous
 * verrou (spot.request_organizer_withdrawal), et le numéro est celui que
 * la personne a elle-même enregistré dans son profil — un champ de
 * saisie au moment du clic ferait d'un formulaire posté le point de
 * décision d'un virement.
 *
 * Aucun argent ne bouge ici : la demande s'inscrit, l'admin verse depuis
 * le compte Mobile Money de SPOT, puis marque la ligne payée. C'est
 * l'arbitrage retenu tant que l'adaptateur Campay n'a pas été confronté
 * à un vrai compte marchand.
 */

/** Référence lisible d'un retrait, ex. SPOTW-7K3F9Q. */
function newWithdrawalReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `SPOTW-${out}`;
}

type OpenedWithdrawal = { o_id: string; o_amount_xaf: number };

/**
 * Destination du versement : le numéro que la personne a désigné.
 *
 * Renvoie une clé de traduction en cas de refus plutôt qu'un message :
 * les deux appelants la rendent dans leur propre écran.
 */
async function resolvePayoutTarget(
  userId: string
): Promise<
  | { ok: true; phone: string; channel: "mtn_momo" | "orange_money" }
  | { ok: false; reason: "noPayoutPhone" | "unknownOperator" }
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("payout_phone")
    .eq("id", userId)
    .maybeSingle();

  const raw = (data?.payout_phone as string | null | undefined) ?? null;
  if (!raw) return { ok: false, reason: "noPayoutPhone" };

  let phone: string;
  try {
    phone = normalizeCameroonPhone(raw);
  } catch (error) {
    if (error instanceof PaymentError) return { ok: false, reason: "noPayoutPhone" };
    throw error;
  }

  const channel = operatorFromPhone(phone);
  if (!channel) return { ok: false, reason: "unknownOperator" };

  return { ok: true, phone, channel };
}

const organizerSchema = z.uuid();

/**
 * L'organisateur demande à retirer son solde.
 *
 * Le montant est le solde entier — il n'y a rien à choisir : ce qui est
 * disponible l'est en totalité, et une demande partielle compliquerait
 * le rapprochement sans rien apporter. La fonction en base refuse tout
 * ce qui dépasse, et l'index partiel empêche une seconde demande tant
 * que la première n'est pas réglée.
 */
export async function requestOrganizerWithdrawal(
  _state: WithdrawalFormState,
  formData: FormData
): Promise<WithdrawalFormState> {
  const t = await getTranslations("money");
  const profile = await requireProfile();

  const parsed = organizerSchema.safeParse(formData.get("organizerId"));
  if (!parsed.success) return { error: t("errors.unavailable") };

  const admin = createAdminClient();

  // Appartenance vérifiée explicitement : la suite se déroule en
  // service_role, qui ignore la RLS.
  const { data: organizer, error: readError } = await admin
    .from("organizers")
    .select("id, owner_id")
    .eq("id", parsed.data)
    .maybeSingle()
    .overrideTypes<{ id: string; owner_id: string } | null, { merge: false }>();

  if (readError) {
    console.error("[retrait] lecture de l'organisateur échouée", readError);
    return { error: t("errors.unavailable") };
  }
  if (!organizer || organizer.owner_id !== profile.id) {
    return { error: t("errors.notOwner") };
  }

  const target = await resolvePayoutTarget(profile.id);
  if (!target.ok) return { error: t(`errors.${target.reason}`) };

  const { data, error } = await admin.rpc("request_organizer_withdrawal", {
    p_organizer_id: organizer.id,
    p_user_id: profile.id,
    p_reference: newWithdrawalReference(),
    p_phone: target.phone,
    p_channel: target.channel,
  });

  if (error) {
    // 23505 : une demande est déjà ouverte. Ce n'est pas une panne, c'est
    // un double clic — ou un aller-retour dans l'historique.
    if (error.code === "23505") return { error: t("errors.alreadyRequested") };
    console.error("[retrait] demande organisateur échouée", error);
    return { error: t("errors.unavailable") };
  }

  const opened = (data as OpenedWithdrawal[] | null)?.[0];
  if (!opened) return { error: t("errors.nothingToWithdraw") };

  refresh();
  return { notice: t("withdrawalRequested") };
}

const creatorSchema = z.uuid();

/**
 * Le creator demande le versement de ce qui lui est dû sur une campagne.
 *
 * La demande n'est pas un virement : c'est un signal adressé à
 * l'organisateur, seul à pouvoir ordonner le paiement. Elle se ferme
 * d'elle-même quand celui-ci clique sur « Verser » — un déclencheur sur
 * spot.payouts s'en charge.
 */
export async function requestCreatorWithdrawal(
  _state: WithdrawalFormState,
  formData: FormData
): Promise<WithdrawalFormState> {
  const t = await getTranslations("money");
  const profile = await requireProfile();

  const parsed = creatorSchema.safeParse(formData.get("campaignId"));
  if (!parsed.success) return { error: t("errors.unavailable") };

  const target = await resolvePayoutTarget(profile.id);
  if (!target.ok) return { error: t(`errors.${target.reason}`) };

  const admin = createAdminClient();

  // Le creator doit avoir un lien sur cette campagne : sans quoi
  // n'importe quel identifiant ouvrirait une demande à zéro franc.
  const { data: link } = await admin
    .from("creator_links")
    .select("id")
    .eq("campaign_id", parsed.data)
    .eq("creator_id", profile.id)
    .maybeSingle();

  if (!link) return { error: t("errors.notInCampaign") };

  const { data, error } = await admin.rpc("request_creator_withdrawal", {
    p_campaign_id: parsed.data,
    p_creator_id: profile.id,
    p_reference: newWithdrawalReference(),
    p_phone: target.phone,
    p_channel: target.channel,
  });

  if (error) {
    if (error.code === "23505") return { error: t("errors.alreadyRequested") };
    console.error("[retrait] demande creator échouée", error);
    return { error: t("errors.unavailable") };
  }

  const opened = (data as OpenedWithdrawal[] | null)?.[0];
  if (!opened) return { error: t("errors.nothingToWithdraw") };

  refresh();
  return { notice: t("payoutRequested") };
}
