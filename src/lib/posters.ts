/**
 * Affiches d'événement, côté lecture.
 *
 * Le bucket « spot-posters » est public : l'URL se construit sans appel
 * réseau ni jeton, ce qui évite un aller-retour Supabase par vignette de
 * l'écran de découverte.
 */

export const POSTER_BUCKET = "spot-posters";

/** Types acceptés — la même liste est imposée par le bucket lui-même. */
export const POSTER_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** 5 Mio, limite du bucket : au-delà, Storage refuse le dépôt. */
export const POSTER_MAX_BYTES = 5 * 1024 * 1024;

/** Extension de fichier déduite du type déclaré, jamais du nom fourni. */
export function posterExtension(mimeType: string): string | null {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

const POSTER_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/i;

/**
 * Le chemin annoncé par le formulaire est-il bien une affiche déposée
 * par cet organisateur ?
 *
 * Le fichier étant téléversé depuis le navigateur, c'est le client qui
 * nomme le chemin : le serveur ne le recopie donc pas sans le vérifier.
 * Storage refuse déjà toute écriture hors du dossier de l'organisateur,
 * mais rien n'empêcherait sinon d'inscrire dans son propre événement le
 * chemin d'une affiche appartenant à quelqu'un d'autre.
 */
export function isOwnPosterPath(path: string, organizerId: string): boolean {
  return POSTER_PATH.test(path) && path.startsWith(`${organizerId}/`);
}

/**
 * URL publique d'une affiche, ou null si l'événement n'en a pas.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` est déjà exposée au navigateur : la
 * construire ici plutôt que d'appeler `getPublicUrl` évite de charger un
 * client Supabase dans un composant qui ne fait qu'afficher une image.
 */
export function posterUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${POSTER_BUCKET}/${path}`;
}
