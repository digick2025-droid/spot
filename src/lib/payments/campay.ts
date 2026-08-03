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
import { verifyHs256Jwt } from "./signature";

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
 * Toujours pas exercé contre le service réel — aucun identifiant n'est
 * disponible — mais la vérification des webhooks suit désormais la
 * documentation HTTP de Campay et non plus une hypothèse de repli.
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

  /**
   * Statut faisant foi, lu directement chez Campay.
   *
   * GET /transaction/{reference}/ — le même vocabulaire que le webhook,
   * mais PENDING y est possible alors que le webhook ne notifie que
   * SUCCESSFUL ou FAILED.
   *
   * Trois issues distinctes, à ne pas confondre : la référence est
   * inconnue (corps forgé), elle existe mais son statut ne fait pas
   * partie du vocabulaire attendu (Campay a changé le sien), ou la
   * lecture elle-même échoue (panne — l'appel lève).
   */
  private async fetchTransactionStatus(
    reference: string
  ): Promise<
    { found: false } | { found: true; status: PaymentStatus | null; raw: unknown }
  > {
    const token = await this.accessToken();

    const response = await fetch(
      `${this.baseUrl}/transaction/${encodeURIComponent(reference)}/`,
      {
        headers: { Authorization: `Token ${token}` },
        cache: "no-store",
      }
    );

    // 404 : la référence n'existe pas chez Campay. Ce n'est pas une panne,
    // c'est un corps forgé — on le distingue d'une indisponibilité.
    if (response.status === 404) return { found: false };

    if (!response.ok) {
      throw new PaymentError(
        `Statut Campay illisible pour ${reference} (HTTP ${response.status}).`,
        true
      );
    }

    const data = (await response.json()) as { status?: unknown };
    return { found: true, status: mapStatus(data.status), raw: data.status };
  }

  /**
   * Vérifie un webhook Campay.
   *
   * Campay ne signe pas le corps : il place dans le corps un champ
   * `signature` contenant un JWT, à valider avec la clé de webhook de
   * l'application (CAMPAY_WEBHOOK_KEY, distincte des identifiants d'API).
   * C'est ce que dit leur documentation HTTP, et c'est la raison pour
   * laquelle le repli HMAC précédent rejetait 100 % des webhooks
   * authentiques.
   *
   * Cette signature ne suffit pourtant pas. La documentation ne publie pas
   * les claims du jeton : rien ne garantit qu'il porte la référence, le
   * montant ou le statut. Un jeton qui ne lie pas le corps est rejouable —
   * qui en capte un une fois pourrait le recoller sur un corps forgé et
   * faire émettre des billets sans paiement.
   *
   * D'où la seconde étape : le webhook ne sert que d'avertissement, et le
   * statut est relu chez Campay pour la référence annoncée. Le corps
   * n'est plus cru sur parole, seulement sur son champ `reference` — et
   * une référence inventée ne survit pas à la relecture. Savoir un jour
   * ce que contient le jeton ne rendrait pas cette étape inutile : elle
   * couvre aussi le rejeu d'un webhook authentique mais périmé.
   */
  async verifyWebhook(rawBody: string): Promise<WebhookVerification> {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { valid: false, reason: "Corps JSON illisible", payload: rawBody };
    }

    const body = payload as Record<string, unknown>;

    const token = typeof body.signature === "string" ? body.signature : null;
    if (!token) {
      return { valid: false, reason: "Champ signature manquant", payload };
    }

    if (!verifyHs256Jwt(token, requireCampayWebhookKey())) {
      return { valid: false, reason: "Signature invalide", payload };
    }

    const providerRef = typeof body.reference === "string" ? body.reference : null;
    if (!providerRef) {
      return { valid: false, reason: "Champ reference manquant", payload };
    }

    // Peut lever : une indisponibilité de Campay doit remonter en 500 pour
    // que la relance serve à quelque chose, pas se déguiser en refus.
    const remote = await this.fetchTransactionStatus(providerRef);

    if (!remote.found) {
      return {
        valid: false,
        reason: `Référence inconnue chez Campay : ${providerRef}`,
        payload,
      };
    }

    const status = remote.status;
    if (!status) {
      return {
        valid: false,
        reason: `Statut Campay inconnu : ${String(remote.raw)}`,
        payload,
      };
    }

    // Le webhook n'annonce qu'un état final ; si la relecture répond
    // encore PENDING, c'est que les deux vues divergent l'instant d'une
    // propagation. Traiter ce « pending » comme le mot de la fin
    // classerait la commande sans billet et sans trace. On lève plutôt :
    // la route répond 500, la relance de Campay retombera sur un statut
    // stabilisé, et l'idempotence n'a rien enregistré entre-temps.
    const announced = mapStatus(body.status);
    if (status === "pending" && (announced === "paid" || announced === "failed")) {
      throw new PaymentError(
        `Campay annonce ${String(body.status)} pour ${providerRef} mais son ` +
          "API répond encore PENDING : statut non stabilisé.",
        true
      );
    }

    // Campay ne documente pas d'identifiant d'ÉVÉNEMENT distinct de la
    // référence de transaction : la clé d'idempotence se compose donc avec
    // le statut, ce qui garde un rejeu identique inoffensif tout en
    // laissant passer la transition pending → paid.
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

function requireCampayWebhookKey(): string {
  const key = process.env.CAMPAY_WEBHOOK_KEY;
  if (!key) {
    throw new Error(
      "CAMPAY_WEBHOOK_KEY est absent de l'environnement : impossible de " +
        "valider la signature des webhooks Campay. La clé se trouve dans " +
        "le tableau de bord Campay, sur l'application concernée."
    );
  }
  return key;
}
