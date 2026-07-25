import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client « service_role » : contourne la RLS.
 *
 * Réservé aux écritures que la RLS interdit volontairement au client —
 * création de commandes, émission des billets, traitement des webhooks de
 * paiement, validation d'un scan. Le montant d'une commande est toujours
 * recalculé ici depuis la base, jamais repris d'un champ envoyé par le
 * navigateur.
 *
 * Ne JAMAIS importer ce module depuis un composant client : l'import
 * « server-only » fait échouer le build si cela arrive.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY est absent de l'environnement. " +
        "Copie-le depuis Supabase → Project Settings → API Keys vers .env.local " +
        "(voir .env.example)."
    );
  }

  return createSupabaseClient(url, secretKey, {
    db: { schema: "spot" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
