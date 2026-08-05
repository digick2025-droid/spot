"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WithdrawalFormState } from "./withdrawal-state";

/**
 * Règlement d'une demande de retrait — la seule écriture de la console.
 *
 * L'ordre des gestes compte : l'admin envoie d'abord l'argent depuis le
 * compte Mobile Money de SPOT, PUIS marque la ligne. Marquer avant
 * d'envoyer libèrerait un nouveau solde à l'organisateur sans qu'il ait
 * rien reçu.
 *
 * spot.settle_withdrawal est idempotente : une ligne déjà réglée renvoie
 * faux plutôt que de bouger deux fois.
 */

const schema = z.object({
  withdrawalId: z.uuid(),
  status: z.enum(["paid", "rejected"]),
});

export async function settleWithdrawal(
  _state: WithdrawalFormState,
  formData: FormData
): Promise<WithdrawalFormState> {
  const t = await getTranslations("money");
  await requireAdmin();

  const parsed = schema.safeParse({
    withdrawalId: formData.get("withdrawalId"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { error: t("errors.unavailable") };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("settle_withdrawal", {
    p_withdrawal_id: parsed.data.withdrawalId,
    p_status: parsed.data.status,
    p_note: parsed.data.status === "rejected" ? "admin_rejected" : "admin_paid",
  });

  if (error) {
    console.error("[retrait] règlement échoué", error);
    return { error: t("errors.unavailable") };
  }

  refresh();
  // Faux : la demande n'était plus ouverte. Un rejeu, ou deux admins.
  return data === false
    ? { notice: t("alreadySettled") }
    : { notice: t("settled") };
}
