import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-spot-signature";

/** HMAC-SHA256 du corps BRUT, en hexadécimal minuscule. */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Comparaison à temps constant : une comparaison naïve `===` fuit le
 * nombre de caractères corrects et permet de reconstruire la signature
 * octet par octet.
 */
export function verifySignature(
  rawBody: string,
  secret: string,
  provided: string | null
): boolean {
  if (!provided) return false;

  const expected = signPayload(rawBody, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided.trim().toLowerCase(), "utf8");

  // timingSafeEqual exige des longueurs égales ; on teste d'abord, ce qui
  // ne révèle que la longueur — information sans valeur ici.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireWebhookSecret(): string {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "PAYMENT_WEBHOOK_SECRET est absent de l'environnement : impossible de " +
        "vérifier la signature des webhooks de paiement."
    );
  }
  return secret;
}
