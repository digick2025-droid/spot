import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase côté serveur (Server Components, Route Handlers, Server Actions).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "spot" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component : les cookies sont en lecture
            // seule ici, le middleware se charge du rafraîchissement de session.
          }
        },
      },
    }
  );
}
