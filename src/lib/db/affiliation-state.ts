/**
 * États des formulaires de l'affiliation.
 *
 * Hors de affiliation-actions.ts : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type AffiliationFormState = { error?: string };

export const initialAffiliationFormState: AffiliationFormState = {};
