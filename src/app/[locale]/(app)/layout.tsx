import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { getOwnedOrganizers, getUser } from "@/lib/auth/dal";
import { getUnreadNotificationCount } from "@/lib/db/notifications";

/**
 * Coque de l'application : en-tête et barre d'onglets, autour de tous les
 * écrans du produit. La vitrine publique (groupe `(site)`) ne passe pas
 * par ici — elle a son propre en-tête et son pied de page.
 *
 * Le fournisseur next-intl est installé ici, sans le dictionnaire
 * `landing` : les textes de la vitrine n'ont rien à faire dans le
 * paquet envoyé au téléphone de quelqu'un qui consulte son billet.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Sert uniquement à décider des onglets affichés : les pages et les
  // Server Actions revérifient les droits pour leur propre compte.
  const [user, ownedOrganizers, allMessages] = await Promise.all([
    getUser(),
    getOwnedOrganizers(),
    getMessages(),
  ]);
  const unreadCount = user ? await getUnreadNotificationCount() : 0;

  const messages = Object.fromEntries(
    Object.entries(allMessages).filter(([namespace]) => namespace !== "landing")
  );

  return (
    <NextIntlClientProvider messages={messages}>
      <AppHeader isSignedIn={user !== null} unreadCount={unreadCount} />
      {children}
      <BottomNav
        canScan={ownedOrganizers.length > 0}
        isSignedIn={user !== null}
      />
    </NextIntlClientProvider>
  );
}
