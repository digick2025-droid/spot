import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider, type PaymentStatus } from "@/lib/payments";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Webhook de paiement — unique porte d'entrée vers l'émission des billets
 * et la confirmation des versements.
 *
 * Trois garanties :
 *
 * 1. Authenticité : la signature est vérifiée sur le corps BRUT, avant
 *    toute interprétation. Un corps non signé n'est jamais traité.
 * 2. Idempotence : chaque événement est enregistré dans payment_events
 *    sous la clé (provider, external_id), qui porte une contrainte
 *    d'unicité. Un rejeu bute sur cette contrainte et sort sans effet.
 * 3. Atomicité : le basculement de la commande, le décrément du stock et
 *    la création des billets se font dans une seule fonction Postgres
 *    verrouillante (spot.mark_order_paid). Côté versement, settle_payout
 *    et fail_payout jouent le même rôle.
 *
 * Deux sens de circulation partagent donc cette route : l'argent qui
 * entre (une commande) et l'argent qui sort (un versement à un creator).
 * La référence de l'agrégateur désigne l'un ou l'autre — jamais les deux,
 * les deux tables portant chacune leur contrainte d'unicité dessus.
 *
 * On répond 200 aux rejeux et aux références inconnues : l'agrégateur n'a
 * rien à réessayer dans ces cas. On réserve les codes d'erreur aux vraies
 * anomalies, pour que ses relances servent à quelque chose.
 */
export async function POST(request: Request): Promise<Response> {
  // Le corps brut, tel qu'il a été signé — surtout pas re-sérialisé.
  const rawBody = await request.text();

  const provider = getPaymentProvider();
  const verification = await provider.verifyWebhook(rawBody, request.headers);
  const admin = createAdminClient();

  if (!verification.valid) {
    // Tentative douteuse : on en garde trace sans lui donner d'effet.
    await admin.from("payment_events").insert({
      provider: provider.name,
      external_id: `rejected_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      event_type: "rejected",
      signature_valid: false,
      payload: { reason: verification.reason, body: rawBody.slice(0, 4000) },
    });

    return Response.json(
      { error: "Webhook refusé", reason: verification.reason },
      { status: 401 }
    );
  }

  // Garde-fou d'idempotence : la contrainte d'unicité fait foi.
  const { data: eventRow, error: insertError } = await admin
    .from("payment_events")
    .insert({
      provider: provider.name,
      external_id: verification.externalId,
      event_type: verification.eventType,
      signature_valid: true,
      payload: verification.payload as object,
    })
    .select("id")
    .single();

  if (insertError) {
    // 23505 = violation d'unicité → déjà traité.
    if (insertError.code === "23505") {
      return Response.json({ status: "déjà traité" }, { status: 200 });
    }
    console.error("[webhook] enregistrement impossible", insertError);
    return Response.json({ error: "Erreur interne" }, { status: 500 });
  }

  // Retrouve la commande par la référence de l'agrégateur, en repli sur
  // notre propre référence si elle est renvoyée.
  let { data: order } = await admin
    .from("orders")
    .select("id, status")
    .eq("provider", provider.name)
    .eq("provider_ref", verification.providerRef)
    .maybeSingle();

  if (!order && verification.reference) {
    const fallback = await admin
      .from("orders")
      .select("id, status")
      .eq("reference", verification.reference)
      .maybeSingle();
    order = fallback.data;
  }

  // Pas une commande : peut-être un versement sortant.
  if (!order) {
    let { data: payout } = await admin
      .from("payouts")
      .select("id, status")
      .eq("provider", provider.name)
      .eq("provider_ref", verification.providerRef)
      .maybeSingle();

    if (!payout && verification.reference) {
      const fallback = await admin
        .from("payouts")
        .select("id, status")
        .eq("reference", verification.reference)
        .maybeSingle();
      payout = fallback.data;
    }

    if (payout) {
      return await handlePayout({
        admin,
        eventId: eventRow.id,
        payoutId: payout.id,
        providerRef: verification.providerRef,
        status: verification.status,
      });
    }

    await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", eventRow.id);

    // Rien à réessayer côté agrégateur : la référence n'existe pas ici.
    return Response.json({ status: "référence inconnue" }, { status: 200 });
  }

  try {
    if (verification.status === "paid") {
      const { data: issued, error } = await admin.rpc("mark_order_paid", {
        p_order_id: order.id,
      });
      if (error) throw new Error(error.message);
      console.info(
        `[webhook] commande ${order.id} payée, ${issued ?? 0} billet(s) émis`
      );
    } else if (verification.status === "failed") {
      const { error } = await admin.rpc("mark_order_failed", {
        p_order_id: order.id,
        p_note: "Paiement refusé par l'opérateur",
      });
      if (error) throw new Error(error.message);
    }
    // « pending » : accusé de réception, rien à faire.

    await admin
      .from("payment_events")
      .update({
        processed_at: new Date().toISOString(),
        order_id: order.id,
      })
      .eq("id", eventRow.id);

    return Response.json({ status: "traité" }, { status: 200 });
  } catch (error) {
    console.error("[webhook] traitement échoué", error);

    // On laisse processed_at à NULL : l'incident reste visible, et une
    // relance de l'agrégateur sera bloquée par l'idempotence. La reprise
    // se fait donc à la main, volontairement — mieux vaut un billet
    // manquant qu'un billet émis deux fois.
    await admin
      .from("payment_events")
      .update({ order_id: order.id })
      .eq("id", eventRow.id);

    return Response.json({ error: "Traitement échoué" }, { status: 500 });
  }
}

/**
 * Sort du webhook côté versement.
 *
 * Symétrique du traitement d'une commande, à une différence près : un
 * échec n'est pas une fin de course. fail_payout remet les commissions
 * au dû, et l'organisateur peut réessayer — le creator n'a rien perdu.
 */
async function handlePayout({
  admin,
  eventId,
  payoutId,
  providerRef,
  status,
}: {
  admin: AdminClient;
  eventId: string;
  payoutId: string;
  providerRef: string;
  status: PaymentStatus;
}): Promise<Response> {
  try {
    if (status === "paid") {
      const { data: settled, error } = await admin.rpc("settle_payout", {
        p_payout_id: payoutId,
        p_provider_ref: providerRef,
      });
      if (error) throw new Error(error.message);

      console.info(
        settled
          ? `[webhook] versement ${payoutId} confirmé`
          : `[webhook] versement ${payoutId} déjà clos, confirmation ignorée`
      );
    } else if (status === "failed") {
      const { data: released, error } = await admin.rpc("fail_payout", {
        p_payout_id: payoutId,
        p_note: "Reversement refusé par l'opérateur",
      });
      if (error) throw new Error(error.message);

      console.info(
        released
          ? `[webhook] versement ${payoutId} échoué, commissions rendues au dû`
          : `[webhook] versement ${payoutId} déjà clos, échec ignoré`
      );
    }
    // « pending » : accusé de réception, rien à faire.

    await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString(), payout_id: payoutId })
      .eq("id", eventId);

    return Response.json({ status: "traité" }, { status: 200 });
  } catch (error) {
    console.error("[webhook] traitement du versement échoué", error);

    // processed_at reste à NULL : l'incident est visible en base, et la
    // reprise se fait à la main plutôt qu'à l'aveugle.
    await admin
      .from("payment_events")
      .update({ payout_id: payoutId })
      .eq("id", eventId);

    return Response.json({ error: "Traitement échoué" }, { status: 500 });
  }
}
