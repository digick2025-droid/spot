import { createBrowserClient } from "@supabase/ssr";

// Client Supabase côté navigateur.
// Les tables SPOT vivent dans le schéma Postgres dédié « spot »
// (le projet Supabase est partagé avec d'autres apps de l'organisation).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { db: { schema: "spot" } }
  );
}
