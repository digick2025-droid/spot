import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/db/affiliation";
import { routing } from "@/i18n/routing";

/**
 * Lien de promo d'un creator : /r/<code>.
 *
 * Trois gestes, dans cet ordre : compter la visite, mémoriser
 * l'attribution dans un cookie, envoyer la personne sur l'événement.
 *
 * Le compteur n'est qu'un indicateur d'affichage — n'importe qui peut
 * rappeler cette URL en boucle. Rien ne s'y joue : la commission naît
 * d'une commande passée à « paid » par le webhook signé, jamais d'un
 * clic. On ne compte d'ailleurs qu'une fois par visiteur déjà porteur du
 * cookie, ce qui rend le chiffre à peu près lisible sans prétendre à
 * l'exactitude.
 *
 * Le cookie est httpOnly : le navigateur ne peut pas se l'attribuer
 * lui-même, et le tunnel d'achat le relit côté serveur.
 *
 * La route vit sous [locale] pour hériter de la langue résolue par le
 * proxy : /r/ABC arrive ici réécrit en /fr/r/ABC.
 */

/** Format produit par newLinkCode() — filtre les URL fantaisistes. */
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

type LinkRow = {
  code: string;
  campaigns: {
    status: string;
    events: { slug: string; status: string } | null;
  } | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; code: string }> }
): Promise<NextResponse> {
  const { locale, code: rawCode } = await params;
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  const code = rawCode.trim().toUpperCase();

  const fallback = () =>
    NextResponse.redirect(new URL(`${prefix}/decouvrir`, request.nextUrl.origin));

  if (!CODE_PATTERN.test(code)) return fallback();

  const admin = createAdminClient();
  const { data: link, error } = await admin
    .from("creator_links")
    .select("code, campaigns!inner ( status, events!inner ( slug, status ) )")
    .eq("code", code)
    .maybeSingle()
    .overrideTypes<LinkRow | null, { merge: false }>();

  if (error) {
    console.error("[affiliation] lecture du lien échouée", error);
    return fallback();
  }

  const event = link?.campaigns?.events;
  if (!link || !event || event.status !== "published") return fallback();

  // Campagne close : le lien continue de mener à l'événement, il ne
  // rapporte simplement plus rien. Mieux qu'une redirection surprise vers
  // une page d'exploration.
  const attributes = link.campaigns?.status === "active";

  const response = NextResponse.redirect(
    new URL(`${prefix}/evenements/${event.slug}`, request.nextUrl.origin)
  );

  if (attributes) {
    if (request.cookies.get(REF_COOKIE)?.value !== code) {
      const { error: clickError } = await admin.rpc("register_creator_click", {
        p_code: code,
      });
      if (clickError) {
        // Un compteur perdu ne justifie pas de casser la visite.
        console.error("[affiliation] compteur de clics échoué", clickError);
      }
    }

    response.cookies.set(REF_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: REF_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  return response;
}
