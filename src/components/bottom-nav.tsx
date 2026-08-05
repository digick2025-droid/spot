"use client";

import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  CampaignIcon,
  ExploreIcon,
  HomeIcon,
  OrganizerIcon,
  PassIcon,
  ProfileIcon,
  TicketIcon,
} from "./icons";

/** Ce que la personne est venue faire ici — pas un droit, un usage. */
export type NavAudience = "guest" | "participant" | "creator" | "organizer";

type Tab = {
  key: string;
  href: string;
  Icon: LucideIcon;
  label: string;
  isActive: (pathname: string) => boolean;
  /** L'onglet mis en avant au centre de la barre. */
  isCenter?: boolean;
};

/**
 * Barre d'onglets.
 *
 * Elle flotte au-dessus du fond plutôt que de le barrer : posée en
 * `sticky`, elle réserve malgré tout sa hauteur dans le flux, si bien
 * qu'aucun écran n'a besoin de prévoir une marge basse pour elle.
 *
 * Le pastillage actif se déduit du chemin, donc le composant est client ;
 * `usePathname` de next-intl renvoie le chemin SANS préfixe de locale, ce
 * qui garde les comparaisons identiques en FR et en EN.
 *
 * **Cinq onglets au maximum, et c'est le centre qui change de métier.**
 * Un participant y trouve son SPOT PASS, un creator ses campagnes, un
 * organisateur son espace. Le reste des destinations ne disparaît pas :
 * elles vivent dans le profil, qui est la porte de tout ce qui n'est pas
 * quotidien. Au-delà de cinq, les libellés se tronquent sur un écran de
 * 375 px et la barre ne se lit plus.
 *
 * Rien ici n'autorise quoi que ce soit : `/scan`, `/creator` et
 * `/organisateur` vérifient les droits pour leur propre compte — un
 * layout ne se rejoue pas à chaque navigation.
 */
export function BottomNav({ audience }: { audience: NavAudience }) {
  const t = useTranslations("app");
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("nav");
  const pathname = usePathname();

  const signedIn = audience !== "guest";

  const tabs: Tab[] = [
    {
      key: "home",
      href: "/accueil",
      Icon: HomeIcon,
      label: t("home"),
      isActive: (p) => p === "/accueil",
    },
    {
      key: "events",
      href: "/decouvrir",
      Icon: ExploreIcon,
      label: t("explore"),
      isActive: (p) => p.startsWith("/decouvrir") || p.startsWith("/evenements"),
    },
  ];

  // Le centre : ce que cette personne-là vient faire le plus souvent.
  if (audience === "organizer") {
    tabs.push({
      key: "organizer",
      href: "/organisateur",
      Icon: OrganizerIcon,
      label: t("mySpace"),
      isActive: (p) => p.startsWith("/organisateur") || p.startsWith("/scan"),
      isCenter: true,
    });
  } else if (audience === "creator") {
    tabs.push({
      key: "creator",
      href: "/creator",
      Icon: CampaignIcon,
      label: t("creatorTab"),
      isActive: (p) => p.startsWith("/creator"),
      isCenter: true,
    });
  } else if (audience === "participant") {
    tabs.push({
      key: "pass",
      href: "/pass",
      Icon: PassIcon,
      label: t("passTab"),
      isActive: (p) => p.startsWith("/pass"),
      isCenter: true,
    });
  }

  tabs.push({
    key: "tickets",
    href: "/billets",
    Icon: TicketIcon,
    label: t("tickets"),
    isActive: (p) => p.startsWith("/billets"),
  });

  tabs.push(
    signedIn
      ? {
          key: "profile",
          href: "/compte",
          Icon: ProfileIcon,
          label: t("profile"),
          isActive: (p) => p.startsWith("/compte"),
        }
      : {
          key: "signin",
          href: "/connexion",
          Icon: ProfileIcon,
          label: tAuth("title"),
          isActive: (p) => p.startsWith("/connexion"),
        }
  );

  return (
    <div className="sticky bottom-0 z-40 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <nav
        aria-label={tNav("label")}
        className="glass mx-auto flex max-w-md items-stretch rounded-[26px] border p-1.5 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.85)]"
      >
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          const { Icon } = tab;

          if (tab.isCenter) {
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="press group flex flex-1 flex-col items-center justify-center gap-1 rounded-[20px] py-1.5"
              >
                <span
                  aria-hidden
                  className={`grad-ember flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:scale-105 ${
                    active ? "glow-brand" : ""
                  }`}
                >
                  <Icon size={19} strokeWidth={2.4} />
                </span>
                <span
                  className={`max-w-full truncate text-[10px] font-semibold ${
                    active ? "text-white" : "text-mist"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`press relative flex flex-1 flex-col items-center gap-1 rounded-[20px] py-2 text-[10px] font-semibold transition-colors ${
                active ? "text-white" : "text-mist hover:text-fog"
              }`}
            >
              {/* La lueur de marque signale l'onglet courant sans avoir à
                  colorer l'icône elle-même, qui resterait terne à cette
                  taille. */}
              {active && (
                <span
                  aria-hidden
                  className="grad-ember absolute top-0 h-8 w-8 rounded-full opacity-45 blur-[14px]"
                />
              )}
              <Icon
                size={21}
                strokeWidth={active ? 2.4 : 1.9}
                className="relative transition-transform duration-300"
                aria-hidden
              />
              <span className="relative max-w-full truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
