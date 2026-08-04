import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LocaleSwitcher } from "./locale-switcher";

/**
 * En-tête commun : logo SP●T (retour à l'accueil), cloche de
 * notifications et bascule de langue.
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
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 pt-6">
      <Link
        href="/accueil"
        aria-label="SPOT"
        className="font-display text-2xl font-extrabold tracking-tight"
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
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-card text-[16px] hover:opacity-90"
          >
            <span aria-hidden>🔔</span>
            {unreadCount > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        )}
        <LocaleSwitcher current={locale} />
      </div>
    </header>
  );
}
