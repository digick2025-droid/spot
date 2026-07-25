"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { createOrder } from "@/lib/db/orders";
import {
  PaymentError,
  normalizeCameroonPhone,
  operatorFromPhone,
  type PaymentChannel,
} from "@/lib/payments";

export type CheckoutState = { error?: string };
export const initialCheckoutState: CheckoutState = {};

const schema = z.object({
  eventSlug: z.string().min(1),
  ticketTypeId: z.uuid(),
  quantity: z.coerce.number().int(),
  channel: z.enum(["mtn_momo", "orange_money"]),
  phone: z.string().min(6),
});

/**
 * Démarre un paiement.
 *
 * Traité comme un point d'entrée public : la session est revérifiée ici,
 * et le montant n'est jamais lu depuis le formulaire — createOrder le
 * recalcule depuis la base.
 */
export async function startPayment(
  _state: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const t = await getTranslations("checkout");
  const profile = await requireProfile();

  const parsed = schema.safeParse({
    eventSlug: formData.get("eventSlug"),
    ticketTypeId: formData.get("ticketTypeId"),
    quantity: formData.get("quantity"),
    channel: formData.get("channel"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: t("errors.invalidForm") };
  }

  let phone: string;
  try {
    phone = normalizeCameroonPhone(parsed.data.phone);
  } catch {
    return { error: t("errors.invalidPhone") };
  }

  // Un numéro MTN ne peut pas payer via Orange Money : autant le dire
  // avant de solliciter l'agrégateur.
  const detected = operatorFromPhone(phone);
  if (detected && detected !== parsed.data.channel) {
    return {
      error: t("errors.channelMismatch", {
        operator: detected === "mtn_momo" ? "MTN MoMo" : "Orange Money",
      }),
    };
  }

  let orderId: string;
  try {
    const order = await createOrder({
      userId: profile.id,
      eventSlug: parsed.data.eventSlug,
      ticketTypeId: parsed.data.ticketTypeId,
      quantity: parsed.data.quantity,
      channel: parsed.data.channel as PaymentChannel,
      phone,
    });
    orderId = order.orderId;
  } catch (error) {
    if (error instanceof PaymentError) {
      return { error: error.message };
    }
    console.error("[paiement] création de commande échouée", error);
    return { error: t("errors.unavailable") };
  }

  const locale = await getLocale();
  return redirect({ href: `/commande/${orderId}`, locale });
}
