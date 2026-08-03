import type { MetadataRoute } from "next";

/**
 * Manifeste PWA — ce qui rend SPOT installable sur l'écran d'accueil.
 *
 * `start_url: "/"` ouvre la version française : `localePrefix: "as-needed"`
 * fait de « / » la racine FR, et un utilisateur anglophone sera redirigé
 * vers /en comme depuis n'importe quel autre point d'entrée.
 *
 * Les couleurs sont celles de la coque sombre du participant (ink), pas
 * du thème clair Organisateur/Admin : c'est l'écran d'accueil et l'écran
 * de démarrage que ces valeurs peignent, donc la première impression.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SPOT — Événements & billetterie",
    short_name: "SPOT",
    description:
      "Trouve les événements du Cameroun et paie tes billets en Mobile Money.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B0F",
    theme_color: "#0B0B0F",
    categories: ["events", "entertainment", "lifestyle"],
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
