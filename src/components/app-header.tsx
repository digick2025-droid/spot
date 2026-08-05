import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { NavAudience } from "./bottom-nav";
import { CampaignIcon, NotificationIcon, OrganizerIcon } from "./icons";
import { LocaleSwitcher } from "./locale-switcher";

/**
 * En-tête commun : logo SP●T (retour à l'accueil), raccourci de rôle,
 * cloche de notifications et bascule de langue.
 *
 * Il reste accroché en haut et laisse le contenu défiler dessous, en
 * verre : sur un écran de téléphone, retrouver l'accueil et ses alertes
 * sans remonter toute une liste d'événements vaut la bande occupée.
 *
 * Le raccourci de rôle ne s'affiche qu'à partir de 640 px : sur un
 * téléphone, la barre d'onglets porte déjà la même destination au centre,
 * et deux entrées vers le même endroit dans un même écran se marchent
 * dessus. Il ne donne aucun droit — les pages visées se défendent seules.
 */
export async function AppHeader({
  isSignedIn,
  unreadCount,
  audience,
}: {
  isSignedIn: boolean;
  unreadCount: number;
  audience: NavAudience;
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("notifications");
  const tApp = await getTranslations("app");

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
          {audience === "organizer" ? (
            <Link
              href="/organisateur"
              className="press font-display hidden items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2 text-[12px] font-extrabold text-fog ring-1 ring-white/10 transition-colors hover:text-white sm:inline-flex"
            >
              <OrganizerIcon size={14} strokeWidth={2.2} aria-hidden />
              {tApp("mySpace")}
            </Link>
          ) : audience === "creator" ? (
            <Link
              href="/creator"
              className="press font-display hidden items-center gap-1.5 rounded-full bg-white/5 px-3.5 py-2 text-[12px] font-extrabold text-fog ring-1 ring-white/10 transition-colors hover:text-white sm:inline-flex"
            >
              <CampaignIcon size={14} strokeWidth={2.2} aria-hidden />
              {tApp("creatorTab")}
            </Link>
          ) : (
            <Link
              href="/organisateur"
              className="press grad-ember glow-brand font-display hidden rounded-full px-3.5 py-2 text-[12px] font-extrabold text-white sm:inline-flex"
            >
              {tApp("becomeOrganizer")}
            </Link>
          )}

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
