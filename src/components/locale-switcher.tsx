"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Bascule FR / EN sur la page courante.
 *
 * `usePathname` ne porte pas la chaîne de requête : changer de langue
 * depuis /decouvrir repart donc de la liste non filtrée. Acceptable tant
 * que les filtres se reposent en un geste ; à revoir si l'on ajoute des
 * écrans dont l'état d'URL est coûteux à reconstruire.
 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-full bg-card p-1 text-xs font-semibold">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            locale === current ? "bg-brand text-white" : "text-mist"
          }`}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
