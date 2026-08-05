import type { Locale } from "@/i18n/routing";

/** Le Cameroun ne pratique pas l'heure d'été : Africa/Douala est UTC+1 constant. */
export const EVENT_TIME_ZONE = "Africa/Douala";

/** Quantité de billets par commande, bornes reprises de la maquette. */
export const MIN_TICKETS_PER_ORDER = 1;
export const MAX_TICKETS_PER_ORDER = 6;

/**
 * Prix en francs CFA. La maquette fait `n.toLocaleString('fr-FR') + ' FCFA'`,
 * donc l'espace des milliers reste français même en anglais — c'est la
 * convention locale, on la conserve.
 */
export function formatPriceXaf(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

/** « 15 août 2026 · 18:00 » en FR, « Aug 15, 2026 · 6 PM » en EN. */
export function formatEventDate(iso: string, locale: Locale): string {
  const date = new Date(iso);

  const day = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: locale === "fr" ? "long" : "short",
    year: "numeric",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);

  const time = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    hour: "numeric",
    minute: locale === "fr" ? "2-digit" : undefined,
    hour12: locale === "en",
    timeZone: EVENT_TIME_ZONE,
  }).format(date);

  return `${day} · ${time}`;
}

/**
 * La soirée est-elle passée ?
 *
 * L'heure de début fait foi, faute d'heure de fin en base : un événement
 * bascule donc à « terminé » quand il commence. C'est le comportement
 * voulu — on ne vend pas un billet pour une porte déjà ouverte, et les
 * retardataires achètent avant de se déplacer.
 *
 * La fonction vit ici, hors des composants : `Date.now()` appelé pendant
 * le rendu est une impureté que React refuse (react-hooks/purity). Elle
 * n'a rien d'un détail de style — l'état affiché doit être décidé une
 * fois, à la requête, pas re-calculé à chaque rendu.
 */
export function isEventOver(startsAt: string): boolean {
  return new Date(startsAt).getTime() < Date.now();
}

/** Forme courte pour les vignettes : « 15 août », « Aug 15 ». */
export function formatEventDateShort(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
    day: "numeric",
    month: locale === "fr" ? "long" : "short",
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(iso));
}
