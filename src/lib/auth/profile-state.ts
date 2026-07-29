/**
 * État du formulaire de profil.
 *
 * Hors de profile-actions.ts : un fichier « use server » ne peut exporter
 * que des fonctions asynchrones (voir state.ts).
 */
export type ProfileState = { error?: string; notice?: string };

export const initialProfileState: ProfileState = {};
