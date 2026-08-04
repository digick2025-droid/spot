/**
 * Adresse publique du site, pour les URL absolues des métadonnées.
 *
 * Les vignettes Open Graph doivent être annoncées en absolu : un robot
 * WhatsApp ou Facebook ne résout pas « /opengraph-image ». Sans base,
 * Next replierait sur localhost et le lien partagé arriverait nu.
 *
 * Trois sources, dans l'ordre :
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — à renseigner le jour où le domaine propre
 *    remplace l'adresse Vercel ; c'est elle qui doit gagner.
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` — le domaine de production, stable
 *    d'un déploiement à l'autre (contrairement à `VERCEL_URL`, propre à
 *    chaque déploiement, qui ferait pointer un partage vers une preview).
 * 3. localhost, en développement.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
