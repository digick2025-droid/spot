import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/**
 * Deux responsabilités enchaînées :
 *
 * 1. next-intl résout la locale et produit la réponse (éventuellement une
 *    redirection vers /en).
 * 2. Supabase rafraîchit le jeton de session et réécrit ses cookies SUR
 *    cette réponse. Sans cette étape, un jeton expiré ne serait jamais
 *    renouvelé et les Server Components verraient l'utilisateur déconnecté.
 *
 * L'ordre importe : les cookies doivent être posés sur la réponse que
 * next-intl a construite, sinon ils sont perdus lors d'une redirection.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "spot" },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() (et non getSession()) : valide le jeton auprès du serveur
  // Auth et déclenche le rafraîchissement si nécessaire.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Tout sauf les routes API, les internes Next.js et les fichiers statiques.
  //
  // « apple-icon » est nommément exclu : les routes de métadonnées de Next
  // n'ont pas d'extension, donc le filtre `.*\..*` ne les attrape pas, et
  // next-intl réécrivait /apple-icon en /fr/apple-icon — soit un 404 et
  // une icône absente de l'écran d'accueil iOS. Toute future route de
  // métadonnées sans extension (icon, opengraph-image) est à ajouter ici ;
  // /manifest.webmanifest et /icons/*.png portent un point et passent déjà.
  matcher: "/((?!api|trpc|_next|_vercel|apple-icon|.*\\..*).*)",
};
