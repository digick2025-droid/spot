import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// La configuration Supabase vient exclusivement de l'environnement
// (.env.local en local, variables du projet en déploiement) — voir .env.example.

/**
 * Hôte du Storage Supabase, d'où viennent les affiches d'événement.
 *
 * Lu à la construction : sans variable d'environnement, la liste reste
 * vide et le build passe quand même (aucune page n'est prérendue), comme
 * le reste de la configuration Supabase.
 */
function supabaseImagePatterns() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];

  try {
    return [
      {
        protocol: "https" as const,
        hostname: new URL(url).hostname,
        pathname: "/storage/v1/object/public/spot-posters/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImagePatterns(),
  },

  /**
   * En-têtes de sécurité, recommandés par le guide PWA de Next.
   *
   * Une application installée sur l'écran d'accueil ne montre plus la
   * barre d'adresse : l'utilisateur n'a plus aucun repère visuel pour
   * juger de ce qu'il regarde. D'où le refus d'être encadré (une page
   * qui nous embarquerait dans une iframe emprunterait notre interface
   * de paiement) et le refus du reniflage de type MIME.
   */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
