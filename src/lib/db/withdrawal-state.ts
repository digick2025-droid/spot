/**
 * État du formulaire de retrait.
 *
 * Hors de withdrawal-actions.ts : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type WithdrawalFormState = { error?: string; notice?: string };

export const initialWithdrawalState: WithdrawalFormState = {};
