"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { signPayload, SIGNATURE_HEADER } from "./signature";

/**
 * Déclenche un webhook de paiement signé, en développement uniquement.
 *
 * Il ne raccourcit rien : la requête part vers la vraie route de webhook,
 * avec une vraie signature, et emprunte exactement le chemin qu'emprunte
 * Campay en production — vérification, idempotence, émission des billets.
 */
export async function simulatePaymentWebhook(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Simulation de webhook interdite en production.");
  }
  if ((process.env.PAYMENT_PROVIDER ?? "mock") !== "mock") {
    throw new Error("Simulation réservée au provider « mock ».");
  }

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

  const body = JSON.stringify({
    event_id: randomUUID(),
    provider_ref: order.provider_ref,
    reference: order.reference,
    status,
  });

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

  revalidatePath(`/commande/${orderId}`);
}
