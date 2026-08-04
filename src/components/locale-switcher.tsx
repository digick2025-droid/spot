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
    <div className="flex gap-0.5 rounded-full bg-white/5 p-0.5 text-[11px] font-bold ring-1 ring-white/10">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          className={`press rounded-full px-2.5 py-1.5 transition-colors ${
            locale === current
              ? "grad-ember text-white"
              : "text-mist hover:text-white"
          }`}
        >
          {locale.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
