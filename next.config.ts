import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// La configuration Supabase vient exclusivement de l'environnement
// (.env.local en local, variables du projet en déploiement) — voir .env.example.
const nextConfig: NextConfig = {
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
