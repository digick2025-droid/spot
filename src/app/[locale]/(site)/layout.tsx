import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

/**
 * Coque de la vitrine publique : accueil, organisateurs, creators.
 *
 * Volontairement sans barre d'onglets ni en-tête d'application — c'est la
 * page qu'un visiteur découvre avant d'avoir un compte, elle a son propre
 * en-tête et son propre pied de page.
 *
 * Côté client, seul le dictionnaire `landing` est embarqué : la vitrine
 * est justement la page où le visiteur n'a encore rien téléchargé.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { landing } = await getMessages();

  return (
    <NextIntlClientProvider messages={{ landing }}>
      <SiteHeader />
      <main className="flex-1 overflow-x-hidden">{children}</main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
