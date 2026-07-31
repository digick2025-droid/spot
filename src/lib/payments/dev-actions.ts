"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { refresh, revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { signPayload, SIGNATURE_HEADER } from "./signature";

/** Refuse la simulation partout où un vrai agrégateur est branché. */
function assertSimulable(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Simulation de webhook interdite en production.");
  }
  if ((process.env.PAYMENT_PROVIDER ?? "mock") !== "mock") {
    throw new Error("Simulation réservée au provider « mock ».");
  }
}

/** Poste un webhook signé vers notre propre route, comme le ferait Campay. */
async function postSignedWebhook(body: string): Promise<void> {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) throw new Error("PAYMENT_WEBHOOK_SECRET absent.");

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";

  const response = await fetch(`${proto}://${host}/api/webhooks/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SIGNATURE_HEADER]: signPayload(body, secret),
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Webhook refusé (HTTP ${response.status}) : ${await response.text()}`
    );
  }
}

/**
 * Déclenche un webhook de paiement signé, en développement uniquement.
 *
 * Il ne raccourcit rien : la requête part vers la vraie route de webhook,
 * avec une vraie signature, et emprunte exactement le chemin qu'emprunte
 * Campay en production — vérification, idempotence, émission des billets.
 */
export async function simulatePaymentWebhook(formData: FormData) {
  assertSimulable();

  const profile = await requireProfile();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (status !== "paid" && status !== "failed") {
    throw new Error(`Statut de simulation invalide : ${status}`);
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, user_id, reference, provider_ref")
    .eq("id", orderId)
    .maybeSingle();

  // On ne simule que sur ses propres commandes, même en développement.
  if (!order || order.user_id !== profile.id) {
    throw new Error("Commande introuvable.");
  }

  await postSignedWebhook(
    JSON.stringify({
      event_id: randomUUID(),
      provider_ref: order.provider_ref,
      reference: order.reference,
      status,
    })
  );

  revalidatePath(`/commande/${orderId}`);
}

/**
 * Confirme (ou fait échouer) un versement, en développement uniquement.
 *
 * Même trajet que le webhook d'encaissement : sans lui, un versement
 * resterait éternellement « en cours » avec le provider mock, et le
 * chemin d'échec — celui qui rend les commissions au dû — ne serait
 * jamais exercé.
 */
export async function simulatePayoutWebhook(formData: FormData) {
  assertSimulable();

  const profile = await requireProfile();
  const payoutId = String(formData.get("payoutId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (status !== "paid" && status !== "failed") {
    throw new Error(`Statut de simulation invalide : ${status}`);
  }

  const admin = createAdminClient();
  const { data: payout } = await admin
    .from("payouts")
    .select(
      "id, reference, provider_ref, campaigns!inner ( events!inner ( organizers!inner ( owner_id ) ) )"
    )
    .eq("id", payoutId)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        reference: string;
        provider_ref: string | null;
        campaigns: { events: { organizers: { owner_id: string } } };
      } | null,
      { merge: false }
    >();

  // On ne simule que sur ses propres versements, même en développement.
  if (!payout || payout.campaigns.events.organizers.owner_id !== profile.id) {
    throw new Error("Versement introuvable.");
  }

  await postSignedWebhook(
    JSON.stringify({
      event_id: randomUUID(),
      provider_ref: payout.provider_ref,
      reference: payout.reference,
      status,
    })
  );

  refresh();
}
