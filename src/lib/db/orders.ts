import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, PaymentError } from "@/lib/payments";
import type { PaymentChannel } from "@/lib/payments";
import { MAX_TICKETS_PER_ORDER, MIN_TICKETS_PER_ORDER } from "@/lib/format";

export type CreateOrderInput = {
  userId: string;
  eventSlug: string;
  ticketTypeId: string;
  quantity: number;
  channel: PaymentChannel;
  phone: string;
};

export type CreateOrderResult = {
  orderId: string;
  reference: string;
  totalXaf: number;
};

/** Référence lisible, ex. SPOT-7K3F9Q. */
function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `SPOT-${out}`;
}

/**
 * Crée une commande et déclenche la demande de paiement.
 *
 * Tout est recalculé ici depuis la base : le prix unitaire vient de
 * `ticket_types`, jamais du navigateur. Le client n'a d'ailleurs aucun
 * droit d'écriture sur `orders` — cette fonction utilise service_role.
 *
 * La commande naît « pending » et le reste : seul le webhook signé peut
 * la faire basculer, et donc déclencher l'émission des billets.
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<CreateOrderResult> {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < MIN_TICKETS_PER_ORDER ||
    input.quantity > MAX_TICKETS_PER_ORDER
  ) {
    throw new PaymentError(
      `Quantité invalide : entre ${MIN_TICKETS_PER_ORDER} et ${MAX_TICKETS_PER_ORDER} billets.`
    );
  }

  const admin = createAdminClient();

  // Le type de billet, son événement, son prix et son stock — source de
  // vérité unique pour le montant.
  const { data: ticketType, error: ttError } = await admin
    .from("ticket_types")
    .select(
      "id, price_xaf, quantity_total, quantity_sold, event_id, events!inner ( id, slug, title, status )"
    )
    .eq("id", input.ticketTypeId)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        price_xaf: number;
        quantity_total: number;
        quantity_sold: number;
        event_id: string;
        events: { id: string; slug: string; title: string; status: string };
      } | null,
      { merge: false }
    >();

  if (ttError) {
    throw new Error(`Lecture du type de billet impossible : ${ttError.message}`);
  }
  if (!ticketType) {
    throw new PaymentError("Type de billet introuvable.");
  }

  // Le billet doit bien appartenir à l'événement demandé : sinon on
  // pourrait payer le tarif d'un événement pour entrer à un autre.
  if (ticketType.events.slug !== input.eventSlug) {
    throw new PaymentError("Ce billet n'appartient pas à cet événement.");
  }
  if (ticketType.events.status !== "published") {
    throw new PaymentError("Cet événement n'est pas ouvert à la vente.");
  }

  const remaining = ticketType.quantity_total - ticketType.quantity_sold;
  if (remaining < input.quantity) {
    throw new PaymentError(
      remaining <= 0
        ? "Ce billet est complet."
        : `Il ne reste que ${remaining} billet(s).`
    );
  }

  const totalXaf = ticketType.price_xaf * input.quantity;
  const reference = newReference();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      reference,
      user_id: input.userId,
      event_id: ticketType.event_id,
      status: "pending",
      total_xaf: totalXaf,
      channel: input.channel,
      payer_phone: input.phone,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    throw new Error(`Création de la commande impossible : ${orderError?.message}`);
  }

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: order.id,
    ticket_type_id: ticketType.id,
    quantity: input.quantity,
    unit_price_xaf: ticketType.price_xaf,
  });

  if (itemError) {
    // La commande sans ligne serait un fantôme : on la marque échouée.
    await admin
      .from("orders")
      .update({ status: "failed", failure_note: "Ligne de commande absente" })
      .eq("id", order.id);
    throw new Error(`Création de la ligne de commande impossible : ${itemError.message}`);
  }

  // Demande d'encaissement auprès de l'agrégateur.
  const provider = getPaymentProvider();
  try {
    const collection = await provider.collect({
      amountXaf: totalXaf,
      phone: input.phone,
      channel: input.channel,
      reference,
      description: `SPOT — ${ticketType.events.title}`,
    });

    await admin
      .from("orders")
      .update({ provider: provider.name, provider_ref: collection.providerRef })
      .eq("id", order.id);
  } catch (error) {
    await admin
      .from("orders")
      .update({
        status: "failed",
        failure_note:
          error instanceof Error ? error.message : "Erreur inconnue du provider",
      })
      .eq("id", order.id);
    throw error;
  }

  return { orderId: order.id, reference, totalXaf };
}

export type OrderStatusView = {
  id: string;
  reference: string;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  total_xaf: number;
  failure_note: string | null;
};

/** Commande de l'utilisateur courant, pour l'écran de suivi. */
export async function getOrderForUser(
  orderId: string,
  userId: string
): Promise<OrderStatusView | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("orders")
    .select("id, reference, status, total_xaf, failure_note, user_id")
    .eq("id", orderId)
    .maybeSingle();

  // Vérification d'appartenance explicite : service_role ignore la RLS.
  if (!data || data.user_id !== userId) return null;

  return {
    id: data.id,
    reference: data.reference,
    status: data.status,
    total_xaf: data.total_xaf,
    failure_note: data.failure_note,
  };
}
