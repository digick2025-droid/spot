import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

// La configuration Supabase vient exclusivement de l'environnement
// (.env.local en local, variables du projet en déploiement) — voir .env.example.
const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
