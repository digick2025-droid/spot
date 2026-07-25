/**
 * État du formulaire de paiement.
 *
 * Hors de actions.ts : un fichier « use server » ne peut exporter que des
 * fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type CheckoutState = { error?: string };

export const initialCheckoutState: CheckoutState = {};
