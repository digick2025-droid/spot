import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { NotificationIcon } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";

/**
 * En-tête commun : logo SP●T (retour à l'accueil), cloche de
 * notifications et bascule de langue.
 *
 * Il reste accroché en haut et laisse le contenu défiler dessous, en
 * verre : sur un écran de téléphone, retrouver l'accueil et ses alertes
 * sans remonter toute une liste d'événements vaut la bande occupée.
 *
 * La cloche n'apparaît que connecté : `/notifications` exige de toute
 * façon une session, ce n'est ici que du confort d'affichage.
 */
export async function AppHeader({
  isSignedIn,
  unreadCount,
}: {
  isSignedIn: boolean;
  unreadCount: number;
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("notifications");

  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3">
        <Link
          href="/accueil"
          aria-label="SPOT"
          className="press font-display text-[22px] font-extrabold"
        >
          <span aria-hidden>
            SP<span className="spot-dot mx-0.5" />T
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {isSignedIn && (
            <Link
              href="/notifications"
              aria-label={t("title")}
              className="press relative flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-fog ring-1 ring-white/10 hover:text-white"
            >
              <NotificationIcon size={17} strokeWidth={2} aria-hidden />
              {unreadCount > 0 && (
                <span
                  aria-hidden
                  className="grad-ember absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-shell"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          <LocaleSwitcher current={locale} />
        </div>
      </div>
    </header>
  );
}
