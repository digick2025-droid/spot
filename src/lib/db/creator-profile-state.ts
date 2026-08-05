/**
 * État du formulaire de profil creator.
 *
 * Hors de creator-profile-actions.ts : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type CreatorProfileFormState = { error?: string; notice?: string };

export const initialCreatorProfileState: CreatorProfileFormState = {};
