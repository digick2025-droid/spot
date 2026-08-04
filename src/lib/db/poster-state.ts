/**
 * Réponse de l'ouverture d'un dépôt d'affiche.
 *
 * Hors de organizer-actions.ts : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type PosterUpload =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };
