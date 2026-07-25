import "server-only";
import type { PaymentProvider } from "./types";
import { MockPaymentProvider } from "./mock";
import { CampayPaymentProvider } from "./campay";

let cached: PaymentProvider | null = null;

/**
 * Provider actif, choisi par PAYMENT_PROVIDER.
 *
 * Défaut « mock » en développement, mais refus explicite en production :
 * livrer sans s'en apercevoir une billetterie qui n'encaisse rien serait
 * pire qu'un démarrage en erreur.
 */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const name = process.env.PAYMENT_PROVIDER ?? "mock";

  if (name === "campay") {
    cached = new CampayPaymentProvider();
  } else if (name === "mock") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PAYMENT_PROVIDER=mock est interdit en production : aucun paiement " +
          "ne serait réellement encaissé. Configure Campay."
      );
    }
    cached = new MockPaymentProvider();
  } else {
    throw new Error(`PAYMENT_PROVIDER inconnu : « ${name} ». Valeurs : mock, campay.`);
  }

  return cached;
}

export * from "./types";
