"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * En-tête de la vitrine publique — sans rapport avec `AppHeader`, qui
 * habille le produit. Ici : les trois pages du site et un seul appel à
 * l'action, « Ouvrir SPOT », qui bascule vers l'application.
 *
 * Composant client uniquement pour l'onglet courant : `usePathname` de
 * next-intl renvoie le chemin sans préfixe de locale, donc la comparaison
 * est la même en FR et en EN.
 */
export function SiteHeader() {
  const t = useTranslations("landing.nav");
  const pathname = usePathname();

  const links = [
    { href: "/", label: t("home") },
    { href: "/organisateurs", label: t("organizers") },
    { href: "/creators", label: t("creators") },
  ];

  return (
    <header className="glass sticky top-0 z-50 border-b py-[0.85rem] sm:py-[1.1rem]">
      <div className="mx-auto flex w-[min(1080px,100%-2.5rem)] flex-wrap items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={t("brand")}
          className="font-display text-[1.35rem] font-extrabold tracking-tight"
        >
          <span aria-hidden>
            SP<span className="spot-dot mx-0.5" />T
          </span>
        </Link>

        <nav
          aria-label={t("label")}
          className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto"
        >
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`press whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-semibold transition-colors ${
                  active
                    ? "bg-surface-high text-white"
                    : "text-mist hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/accueil"
          className="press grad-ember glow-brand font-display rounded-full px-[1.1rem] py-2.5 text-[0.82rem] font-extrabold text-white"
        >
          {t("open")}
        </Link>
      </div>
    </header>
  );
}
