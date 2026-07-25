/**
 * Contrat commun aux agrégateurs Mobile Money.
 *
 * L'application ne connaît que cette interface : Campay est une
 * implémentation parmi d'autres, et le provider « mock » permet de
 * dérouler tout le tunnel en développement sans compte externe.
 */

export type PaymentChannel = "mtn_momo" | "orange_money";

/** Statut normalisé, indépendant du vocabulaire de chaque agrégateur. */
export type PaymentStatus = "pending" | "paid" | "failed";

export type CollectionRequest = {
  /** Montant entier en francs CFA — le XAF n'a pas de sous-unité. */
  amountXaf: number;
  /** Numéro payeur au format international, ex. +237671234567. */
  phone: string;
  channel: PaymentChannel;
  /** Notre référence de commande, renvoyée telle quelle par le webhook. */
  reference: string;
  description: string;
};

export type CollectionResult = {
  /** Référence de la transaction chez l'agrégateur. */
  providerRef: string;
  status: PaymentStatus;
};

export type DisbursementRequest = {
  amountXaf: number;
  phone: string;
  channel: PaymentChannel;
  reference: string;
  description: string;
};

export type DisbursementResult = {
  providerRef: string;
  status: PaymentStatus;
};

/**
 * Résultat de la vérification d'un webhook entrant.
 *
 * `valid: false` n'est jamais une erreur technique à relancer : c'est une
 * requête à rejeter. On la journalise quand même dans payment_events pour
 * garder trace des tentatives.
 */
export type WebhookVerification =
  | {
      valid: true;
      /** Identifiant de l'ÉVÉNEMENT chez l'agrégateur — clé d'idempotence. */
      externalId: string;
      /** Référence de la TRANSACTION, pour retrouver la commande. */
      providerRef: string;
      /** Notre propre référence de commande, si l'agrégateur la renvoie. */
      reference: string | null;
      status: PaymentStatus;
      eventType: string;
      payload: unknown;
    }
  | { valid: false; reason: string; payload: unknown };

export interface PaymentProvider {
  readonly name: string;

  /** Encaissement : déclenche la demande de paiement sur le téléphone. */
  collect(request: CollectionRequest): Promise<CollectionResult>;

  /** Reversement vers un organisateur ou un creator (Phase 2). */
  disburse(request: DisbursementRequest): Promise<DisbursementResult>;

  /** Vérifie l'authenticité d'un webhook à partir du corps BRUT. */
  verifyWebhook(
    rawBody: string,
    headers: Headers
  ): Promise<WebhookVerification>;
}

/** Erreur métier d'un provider, distincte d'une panne réseau. */
export class PaymentError extends Error {
  constructor(
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * Normalise un numéro camerounais vers +2376XXXXXXXX.
 * Accepte « 6 71 23 45 67 », « 237671234567 », « +237 671 234 567 ».
 */
export function normalizeCameroonPhone(input: string): string {
  const digits = input.replace(/\D/g, "");

  const local = digits.startsWith("237") ? digits.slice(3) : digits;

  if (!/^6\d{8}$/.test(local)) {
    throw new PaymentError(
      "Numéro camerounais invalide : 9 chiffres commençant par 6 attendus."
    );
  }

  return `+237${local}`;
}

/**
 * Déduit l'opérateur du préfixe, pour vérifier la cohérence avec le canal
 * choisi. MTN : 67, 650-654, 680-684. Orange : 69, 655-659, 685-689.
 */
export function operatorFromPhone(phone: string): PaymentChannel | null {
  const local = phone.replace(/\D/g, "").replace(/^237/, "");
  if (!/^6\d{8}$/.test(local)) return null;

  const p2 = local.slice(0, 2);
  const p3 = Number(local.slice(1, 3));

  if (p2 === "67") return "mtn_momo";
  if (p2 === "69") return "orange_money";
  if (p2 === "65") return p3 >= 50 && p3 <= 54 ? "mtn_momo" : "orange_money";
  if (p2 === "68") return p3 >= 80 && p3 <= 84 ? "mtn_momo" : "orange_money";

  return null;
}
