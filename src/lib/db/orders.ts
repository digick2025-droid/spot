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
  /** Code du lien creator porté par le cookie d'affiliation, s'il y en a un. */
  refCode?: string | null;
  /**
   * Le cadeau : à qui, et le mot joint. Null pour un achat ordinaire.
   *
   * C'est la présence du nom qui fait le cadeau, ici comme en base :
   * `mark_order_paid` en déduit qu'il faut tirer un code de réclamation
   * par billet émis.
   */
  giftRecipientName?: string | null;
  giftMessage?: string | null;
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
 * Lien creator à porter sur la commande, ou null.
 *
 * Le code vient d'un cookie httpOnly posé par /r/[code] : il n'est jamais
 * transmis par le formulaire, et il est revalidé ici plutôt que cru sur
 * parole. Trois motifs de refus :
 *
 *  - la campagne n'est plus ouverte ;
 *  - le lien promeut un autre événement (un cookie traîne, l'achat n'a
 *    rien à voir) ;
 *  - le creator est l'acheteur, qui se commissionnerait sur lui-même.
 *
 * Un refus n'empêche jamais l'achat : il retire seulement l'attribution.
 */
async function resolveCreatorLink(
  refCode: string | null | undefined,
  eventId: string,
  buyerId: string
): Promise<string | null> {
  if (!refCode) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("creator_links")
    .select("id, creator_id, campaigns!inner ( status, event_id )")
    .eq("code", refCode)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        creator_id: string;
        campaigns: { status: string; event_id: string };
      } | null,
      { merge: false }
    >();

  if (error) {
    // L'attribution est un bonus : son échec ne doit pas coûter la vente.
    console.error("[affiliation] résolution du lien échouée", error);
    return null;
  }
  if (!data) return null;
  if (data.campaigns.status !== "active") return null;
  if (data.campaigns.event_id !== eventId) return null;
  if (data.creator_id === buyerId) return null;

  return data.id;
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
  const creatorLinkId = await resolveCreatorLink(
    input.refCode,
    ticketType.event_id,
    input.userId
  );

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
      creator_link_id: creatorLinkId,
      gift_recipient_name: input.giftRecipientName ?? null,
      gift_message: input.giftMessage ?? null,
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
