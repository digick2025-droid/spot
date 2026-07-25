import "server-only";
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

const BASE_URL = {
  sandbox: "https://demo.campay.net/api",
  production: "https://www.campay.net/api",
} as const;

/** Vocabulaire Campay → statut normalisé. */
function mapStatus(raw: unknown): PaymentStatus | null {
  switch (String(raw).toUpperCase()) {
    case "SUCCESSFUL":
      return "paid";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    case "PENDING":
      return "pending";
    default:
      return null;
  }
}

/**
 * Adaptateur Campay (MTN MoMo + Orange Money).
 *
 * Non exercé contre le service réel : aucun identifiant n'était disponible
 * au moment de l'écriture. La structure est complète, mais deux points
 * sont à confirmer contre la documentation Campay à la première connexion
 * réelle, et sont signalés ci-dessous par « À CONFIRMER ».
 */
export class CampayPaymentProvider implements PaymentProvider {
  readonly name = "campay";

  private token: { value: string; expiresAt: number } | null = null;

  private get baseUrl(): string {
    return process.env.CAMPAY_ENV === "production"
      ? BASE_URL.production
      : BASE_URL.sandbox;
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.value;
    }

    const username = process.env.CAMPAY_APP_USERNAME;
    const password = process.env.CAMPAY_APP_PASSWORD;

    if (!username || !password) {
      throw new PaymentError(
        "CAMPAY_APP_USERNAME et CAMPAY_APP_PASSWORD sont requis lorsque " +
          "PAYMENT_PROVIDER=campay."
      );
    }

    const response = await fetch(`${this.baseUrl}/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new PaymentError(
        `Authentification Campay refusée (HTTP ${response.status}).`,
        response.status >= 500
      );
    }

    const data = (await response.json()) as { token?: string; expires_in?: number };
    if (!data.token) {
      throw new PaymentError("Réponse Campay sans jeton d'accès.");
    }

    this.token = {
      value: data.token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return this.token.value;
  }

  async collect(request: CollectionRequest): Promise<CollectionResult> {
    const token = await this.accessToken();

    const response = await fetch(`${this.baseUrl}/collect/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        amount: String(request.amountXaf),
        currency: "XAF",
        // Campay attend le numéro sans le « + ».
        from: request.phone.replace(/^\+/, ""),
        description: request.description,
        external_reference: request.reference,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new PaymentError(
        `Demande d'encaissement Campay refusée (HTTP ${response.status}).`,
        response.status >= 500
      );
    }

    const data = (await response.json()) as { reference?: string };
    if (!data.reference) {
      throw new PaymentError("Réponse Campay sans référence de transaction.");
    }

    return { providerRef: data.reference, status: "pending" };
  }

  async disburse(request: DisbursementRequest): Promise<DisbursementResult> {
    const token = await this.accessToken();

    const response = await fetch(`${this.baseUrl}/withdraw/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        amount: String(request.amountXaf),
        currency: "XAF",
        to: request.phone.replace(/^\+/, ""),
        description: request.description,
        external_reference: request.reference,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new PaymentError(
        `Reversement Campay refusé (HTTP ${response.status}).`,
        response.status >= 500
      );
    }

    const data = (await response.json()) as { reference?: string };
    if (!data.reference) {
      throw new PaymentError("Réponse Campay sans référence de reversement.");
    }

    return { providerRef: data.reference, status: "pending" };
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

    // À CONFIRMER : Campay transmet une signature dans le corps (champ
    // `signature`, un JWT) plutôt qu'en en-tête. Tant que ce n'est pas
    // vérifié contre leur documentation avec un compte réel, on exige la
    // même signature HMAC que le provider mock — plutôt refuser un webhook
    // authentique que d'en accepter un forgé.
    const secret = requireWebhookSecret();
    if (!verifySignature(rawBody, secret, headers.get(SIGNATURE_HEADER))) {
      return { valid: false, reason: "Signature invalide", payload };
    }

    const body = payload as Record<string, unknown>;
    const providerRef = typeof body.reference === "string" ? body.reference : null;
    const status = mapStatus(body.status);

    if (!providerRef) {
      return { valid: false, reason: "Champ reference manquant", payload };
    }
    if (!status) {
      return {
        valid: false,
        reason: `Statut Campay inconnu : ${String(body.status)}`,
        payload,
      };
    }

    // À CONFIRMER : Campay ne documente pas d'identifiant d'ÉVÉNEMENT
    // distinct de la référence de transaction. On compose donc la clé
    // d'idempotence avec le statut, ce qui garde un rejeu identique
    // inoffensif tout en laissant passer la transition pending → paid.
    return {
      valid: true,
      externalId: `${providerRef}:${status}`,
      providerRef,
      reference:
        typeof body.external_reference === "string" ? body.external_reference : null,
      status,
      eventType: `payment.${status}`,
      payload,
    };
  }
}
