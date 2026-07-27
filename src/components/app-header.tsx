import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LocaleSwitcher } from "./locale-switcher";

/** En-tête commun : logo SP●T (retour à l'accueil) et bascule de langue. */
export async function AppHeader() {
  const locale = (await getLocale()) as Locale;

  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 pt-6">
      <Link
        href="/"
        aria-label="SPOT"
        className="font-display text-2xl font-extrabold tracking-tight"
      >
        <span aria-hidden>
          SP<span className="spot-dot mx-0.5" />T
        </span>
      </Link>
      <LocaleSwitcher current={locale} />
    </header>
  );
}
