import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { AppHeader } from "@/components/app-header";
import { BottomNav, type NavAudience } from "@/components/bottom-nav";
import { getOwnedOrganizers, getUser, isCreator } from "@/lib/auth/dal";
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
  const [user, ownedOrganizers, creator, allMessages] = await Promise.all([
    getUser(),
    getOwnedOrganizers(),
    isCreator(),
    getMessages(),
  ]);
  const unreadCount = user ? await getUnreadNotificationCount() : 0;

  // Qui tient une maison la tient d'abord : un organisateur est souvent
  // creator aussi, et c'est son espace qu'il ouvre en premier.
  const audience: NavAudience = !user
    ? "guest"
    : ownedOrganizers.length > 0
      ? "organizer"
      : creator
        ? "creator"
        : "participant";

  const messages = Object.fromEntries(
    Object.entries(allMessages).filter(([namespace]) => namespace !== "landing")
  );

  return (
    <NextIntlClientProvider messages={messages}>
      <AppHeader
        isSignedIn={user !== null}
        unreadCount={unreadCount}
        audience={audience}
      />
      {children}
      <BottomNav audience={audience} />
    </NextIntlClientProvider>
  );
}
