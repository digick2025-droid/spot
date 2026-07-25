import "server-only";
import { randomUUID } from "node:crypto";
import {
  PaymentError,
  type CollectionRequest,
  type CollectionResult,
  type DisbursementRequest,
  type DisbursementResult,
  type PaymentProvider,
  type PaymentStatus,
  type WebhookVerification,
} from "./types";
import { SIGNATURE_HEADER, requireWebhookSecret, verifySignature } from "./signature";

/**
 * Provider de développement.
 *
 * Il ne contacte aucun service : `collect` renvoie « pending » avec une
 * référence, exactement comme un vrai agrégateur, et c'est le webhook —
 * signé de la même façon qu'en production — qui fera basculer la commande.
 * Le tunnel complet (commande → webhook → émission des billets) est donc
 * exercé pour de vrai, seul l'appel réseau sortant est absent.
 *
 * Convention de test : un montant se terminant par 13 échoue, ce qui
 * permet de dérouler le chemin d'échec sans configuration.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async collect(request: CollectionRequest): Promise<CollectionResult> {
    if (request.amountXaf <= 0) {
      throw new PaymentError("Montant à encaisser invalide.");
    }

    return {
      providerRef: `mock_${randomUUID()}`,
      status: "pending",
    };
  }

  async disburse(request: DisbursementRequest): Promise<DisbursementResult> {
    if (request.amountXaf <= 0) {
      throw new PaymentError("Montant à reverser invalide.");
    }

    return {
      providerRef: `mockd_${randomUUID()}`,
      status: "pending",
    };
  }

  async verifyWebhook(
    rawBody: string,
    headers: Headers
  ): Promise<WebhookVerification> {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "Corps JSON illisible", payload: rawBody };
    }

    const secret = requireWebhookSecret();
    if (!verifySignature(rawBody, secret, headers.get(SIGNATURE_HEADER))) {
      return { valid: false, reason: "Signature invalide", payload };
    }

    const body = payload as Record<string, unknown>;
    const externalId = typeof body.event_id === "string" ? body.event_id : null;
    const providerRef =
      typeof body.provider_ref === "string" ? body.provider_ref : null;
    const status = body.status;

    if (!externalId || !providerRef) {
      return {
        valid: false,
        reason: "Champs event_id ou provider_ref manquants",
        payload,
      };
    }
    if (status !== "paid" && status !== "failed" && status !== "pending") {
      return { valid: false, reason: `Statut inconnu : ${String(status)}`, payload };
    }

    return {
      valid: true,
      externalId,
      providerRef,
      reference: typeof body.reference === "string" ? body.reference : null,
      status: status as PaymentStatus,
      eventType: `payment.${status}`,
      payload,
    };
  }
}
