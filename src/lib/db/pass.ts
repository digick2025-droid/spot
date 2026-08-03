import "server-only";
import { createClient } from "@/lib/supabase/server";
import { EVENT_TIME_ZONE } from "@/lib/format";

/**
 * Données du SPOT PASS.
 *
 * Tout est dérivé des billets détenus, pas des billets scannés : les
 * points étant crédités à l'achat (décision produit), le passeport
 * raconte la même histoire — ce que la personne a réservé, pas sa
 * présence effective à l'entrée.
 */

/** Barème de la maquette : GOLD à 2 000 points, SILVER à 1 000. */
const LEVELS = [
  { key: "gold", from: 2000 },
  { key: "silver", from: 1000 },
  { key: "bronze", from: 0 },
] as const;

export type PassLevel = (typeof LEVELS)[number]["key"];

/**
 * Badges de la maquette, chacun adossé à une règle vérifiable.
 * Les seuils vivent ici pour rester ajustables d'un seul endroit.
 */
const BADGES = [
  { key: "musicLover", emoji: "🎵", test: (s: PassStats) => inCategory(s, "concert") >= 3 },
  { key: "nightExplorer", emoji: "🔥", test: (s: PassStats) => s.nightEvents >= 3 },
  {
    key: "knowledgeHunter",
    emoji: "🎓",
    test: (s: PassStats) => inCategory(s, "formation") >= 3,
  },
  { key: "roadTripper", emoji: "🌍", test: (s: PassStats) => s.cities >= 2 },
  { key: "spotLegend", emoji: "🏆", test: (s: PassStats) => s.eventsLived >= 10 },
] as const;

/** Une catégorie jamais fréquentée est absente du décompte, pas à zéro. */
function inCategory(stats: PassStats, key: string): number {
  return stats.byCategory[key] ?? 0;
}

/** Une soirée commence à 20 h, heure de Douala. */
const NIGHT_HOUR = 20;

type PassStats = {
  eventsLived: number;
  cities: number;
  nightEvents: number;
  byCategory: Record<string, number>;
};

export type PassBadge = {
  key: string;
  emoji: string;
  unlocked: boolean;
};

/** Un « moment vécu » : la vignette tamponnée du passeport. */
export type PassStamp = {
  eventId: string;
  slug: string;
  title: string;
  city: string;
  categoryKey: string | null;
  startsAt: string;
  glyph: string | null;
  gradient: string | null;
};

export type PassSummary = {
  points: number;
  level: PassLevel;
  /** Palier suivant, ou null quand le niveau maximal est atteint. */
  nextLevelAt: number | null;
  eventsLived: number;
  cities: number;
  topCategoryKey: string | null;
  badges: PassBadge[];
  stamps: PassStamp[];
};

type TicketRow = {
  event_id: string;
  status: string;
  events: {
    id: string;
    slug: string;
    title: string;
    city: string;
    category_key: string | null;
    starts_at: string;
    glyph: string | null;
    gradient: string | null;
  } | null;
};

/** Heure locale de Douala — le fuseau n'a pas d'heure d'été. */
function hourInDouala(iso: string): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: EVENT_TIME_ZONE,
  }).format(new Date(iso));

  return Number.parseInt(formatted, 10);
}

/**
 * Niveau correspondant à un total de points.
 *
 * Exporté pour que la console d'administration lise le même barème que
 * le passeport : deux tables de seuils divergeraient tôt ou tard.
 */
export function passLevelFor(points: number): PassLevel {
  return levelFor(points).level;
}

function levelFor(points: number): { level: PassLevel; nextLevelAt: number | null } {
  const index = LEVELS.findIndex((l) => points >= l.from);
  const level = LEVELS[index].key;
  // LEVELS est trié du plus haut au plus bas : le palier suivant est
  // celui juste au-dessus, absent quand on est déjà au sommet.
  const nextLevelAt = index === 0 ? null : LEVELS[index - 1].from;
  return { level, nextLevelAt };
}

/**
 * Passeport de l'utilisateur courant.
 *
 * La RLS fait le filtrage (point_entries_select_own, tickets_select_own) :
 * inutile de répéter un filtre sur l'identifiant, c'est la base qui fait
 * autorité.
 */
export async function getMyPass(): Promise<PassSummary> {
  const supabase = await createClient();

  const [pointsResult, ticketsResult] = await Promise.all([
    supabase.from("point_entries").select("points"),
    supabase
      .from("tickets")
      .select(
        `event_id, status,
         events ( id, slug, title, city, category_key, starts_at, glyph, gradient )`
      )
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .overrideTypes<TicketRow[], { merge: false }>(),
  ]);

  if (pointsResult.error) {
    throw new Error(`Lecture des points impossible : ${pointsResult.error.message}`);
  }
  if (ticketsResult.error) {
    throw new Error(
      `Lecture des moments impossible : ${ticketsResult.error.message}`
    );
  }

  const points = (pointsResult.data ?? []).reduce((sum, row) => sum + row.points, 0);

  // Plusieurs billets pour un même événement ne comptent qu'un moment.
  const stamps = new Map<string, PassStamp>();
  for (const ticket of ticketsResult.data ?? []) {
    const event = ticket.events;
    // Un événement devenu non public sort du périmètre de la RLS : le
    // billet reste, sa vignette n'est plus affichable.
    if (!event || stamps.has(event.id)) continue;

    stamps.set(event.id, {
      eventId: event.id,
      slug: event.slug,
      title: event.title,
      city: event.city,
      categoryKey: event.category_key,
      startsAt: event.starts_at,
      glyph: event.glyph,
      gradient: event.gradient,
    });
  }

  const moments = [...stamps.values()];
  const byCategory: Record<string, number> = {};
  const cities = new Set<string>();
  let nightEvents = 0;

  for (const moment of moments) {
    cities.add(moment.city);
    if (hourInDouala(moment.startsAt) >= NIGHT_HOUR) nightEvents += 1;
    if (moment.categoryKey) {
      byCategory[moment.categoryKey] = (byCategory[moment.categoryKey] ?? 0) + 1;
    }
  }

  const stats: PassStats = {
    eventsLived: moments.length,
    cities: cities.size,
    nightEvents,
    byCategory,
  };

  const topCategoryKey =
    Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    points,
    ...levelFor(points),
    eventsLived: stats.eventsLived,
    cities: stats.cities,
    topCategoryKey,
    badges: BADGES.map((badge) => ({
      key: badge.key,
      emoji: badge.emoji,
      unlocked: badge.test(stats),
    })),
    stamps: moments,
  };
}
