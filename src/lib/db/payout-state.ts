/**
 * États des formulaires de versement.
 *
 * Hors de payout-actions.ts : un fichier « use server » ne peut exporter
 * que des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type PayoutFormState = { error?: string; notice?: string };

export const initialPayoutState: PayoutFormState = {};
