/**
 * Le vocabulaire des réseaux sociaux, côté client comme côté serveur.
 *
 * Hors de creator-profile.ts, qui est « server-only » : le formulaire de
 * saisie est un composant client et a besoin de la LISTE, pas d'un accès
 * à la base. Importer la liste depuis le module serveur y entraînerait
 * le client Supabase, et le build s'arrête là — c'est exactement ce que
 * « server-only » sert à empêcher.
 *
 * L'ordre est celui de l'usage au Cameroun : ce qui compte d'abord pour
 * un organisateur qui regarde une audience.
 */
export const SOCIAL_NETWORKS = [
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "x",
  "snapchat",
  "whatsapp",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export type CreatorSocial = {
  network: SocialNetwork;
  handle: string;
  /** DÉCLARÉ par le creator : aucune API de réseau n'est interrogée. */
  followersCount: number;
};
