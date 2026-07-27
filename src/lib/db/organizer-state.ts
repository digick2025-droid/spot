/**
 * États des formulaires de l'espace organisateur.
 *
 * Hors de organizer-actions.ts : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type OrganizerFormState = { error?: string };

export const initialOrganizerFormState: OrganizerFormState = {};
