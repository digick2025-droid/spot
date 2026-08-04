"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

type Tab = {
  key: string;
  href: string;
  emoji: string;
  label: string;
  isActive: (pathname: string) => boolean;
  /** L'onglet mis en avant au centre de la barre (maquette : SPOT PASS). */
  isCenter?: boolean;
};

/**
 * Barre d'onglets du participant (maquette : écran « TAB BAR »).
 *
 * Le pastillage actif se déduit du chemin, donc le composant est client ;
 * `usePathname` de next-intl renvoie le chemin SANS préfixe de locale, ce
 * qui garde les comparaisons identiques en FR et en EN.
 *
 * L'onglet Scanner n'est affiché qu'aux propriétaires d'un organisateur —
 * c'est du confort d'affichage, pas une autorisation : `/scan` vérifie
 * lui-même les droits, un layout ne se rejouant pas à chaque navigation.
 *
 * Même logique pour le SPOT PASS, à l'emplacement central : il n'a de sens
 * qu'une fois connecté, et `/pass` exige de toute façon une session.
 */
export function BottomNav({
  canScan,
  isSignedIn,
}: {
  canScan: boolean;
  isSignedIn: boolean;
}) {
  const t = useTranslations("app");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const pathname = usePathname();

  const tabs: Tab[] = [
    {
      key: "home",
      href: "/accueil",
      emoji: "🏠",
      label: t("home"),
      isActive: (p) => p === "/accueil",
    },
    {
      key: "discover",
      href: "/decouvrir",
      emoji: "🔍",
      label: t("explore"),
      isActive: (p) => p.startsWith("/decouvrir") || p.startsWith("/evenements"),
    },
  ];

  if (isSignedIn) {
    tabs.push({
      key: "pass",
      href: "/pass",
      emoji: "🎫",
      label: t("passTab"),
      isActive: (p) => p.startsWith("/pass"),
      isCenter: true,
    });
  }

  tabs.push({
    key: "tickets",
    href: "/billets",
    emoji: "🎟",
    label: t("tickets"),
    isActive: (p) => p.startsWith("/billets"),
  });

  if (canScan) {
    tabs.push({
      key: "scan",
      href: "/scan",
      emoji: "📷",
      label: t("scanner"),
      isActive: (p) => p.startsWith("/scan"),
    });
  }

  tabs.push(
    isSignedIn
      ? {
          key: "profile",
          href: "/compte",
          emoji: "👤",
          label: t("profile"),
          isActive: (p) => p.startsWith("/compte"),
        }
      : {
          key: "signin",
          href: "/connexion",
          emoji: "👤",
          label: tAuth("title"),
          isActive: (p) => p.startsWith("/connexion"),
        }
  );

  return (
    <nav
      aria-label={tNav("label")}
      className="sticky bottom-0 z-40 flex items-stretch border-t border-white/10 bg-shell px-1.5 pt-2 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      {tabs.map((tab) => {
        const active = tab.isActive(pathname);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-[3px] rounded-xl py-1.5 text-[10px] font-semibold transition-colors ${
              active ? "text-brand" : "text-mist hover:text-fog"
            }`}
          >
            <span
              aria-hidden
              className={
                tab.isCenter
                  ? "flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[18px] leading-none text-white"
                  : "text-[19px] leading-none"
              }
            >
              {tab.emoji}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
