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

/**
 * Vérifie un JWT signé en HS256 et rend ses claims, ou null.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : on n'a besoin que
 * d'un seul algorithme, et les failles classiques des vérificateurs JWT
 * viennent justement de leur souplesse.
 *
 * Deux refus explicites en découlent. « alg: none » supprime la
 * signature et rendrait n'importe quel jeton valide. « alg: RS256 »
 * ferait interpréter notre secret partagé comme une clé PUBLIQUE : un
 * attaquant signerait avec, puisqu'il la connaîtrait. On n'accepte donc
 * que ce qu'on attend, au lieu de faire confiance à l'en-tête du jeton.
 */
export function verifyHs256Jwt(
  token: string,
  key: string
): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header: { alg?: unknown };
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (header.alg !== "HS256") return null;

  const expected = createHmac("sha256", key)
    .update(`${encodedHeader}.${encodedPayload}`, "utf8")
    .digest();
  const provided = Buffer.from(encodedSignature, "base64url");

  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  // Honorées si présentes — la doc Campay ne dit pas si elles le sont.
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && now >= claims.exp) return null;
  if (typeof claims.nbf === "number" && now < claims.nbf) return null;

  return claims;
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
