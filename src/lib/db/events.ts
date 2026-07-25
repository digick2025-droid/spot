import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Category = {
  key: string;
  emoji: string;
  label_fr: string;
  label_en: string;
  sort: number;
};

export type EventOrganizer = {
  id: string;
  name: string;
  slug: string;
  glyph: string | null;
  gradient: string | null;
  verified: boolean;
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  city: string;
  venue: string;
  starts_at: string;
  glyph: string | null;
  gradient: string | null;
  category_key: string | null;
  organizers: EventOrganizer;
  ticket_types: { price_xaf: number }[];
};

export type TicketType = {
  id: string;
  name_fr: string;
  name_en: string;
  price_xaf: number;
  quantity_total: number;
  quantity_sold: number;
  sort: number;
};

export type EventDetail = Omit<EventSummary, "ticket_types"> & {
  description_fr: string | null;
  description_en: string | null;
  ticket_types: TicketType[];
};

const SUMMARY_COLUMNS = `
  id, slug, title, city, venue, starts_at, glyph, gradient, category_key,
  organizers ( id, name, slug, glyph, gradient, verified ),
  ticket_types ( price_xaf )
`;

const DETAIL_COLUMNS = `
  id, slug, title, city, venue, starts_at, glyph, gradient, category_key,
  description_fr, description_en,
  organizers ( id, name, slug, glyph, gradient, verified ),
  ticket_types ( id, name_fr, name_en, price_xaf, quantity_total, quantity_sold, sort )
`;

export type EventFilters = {
  city?: string;
  category?: string;
  search?: string;
  limit?: number;
};

/**
 * Événements publiés à venir.
 *
 * Le filtre `status = 'published'` est déjà imposé par la RLS ; on le
 * répète ici pour que l'intention soit lisible et que la requête reste
 * correcte si elle est un jour exécutée en service_role.
 */
export async function listEvents(
  filters: EventFilters = {}
): Promise<EventSummary[]> {
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select(SUMMARY_COLUMNS)
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (filters.city && filters.city !== "all") {
    query = query.eq("city", filters.city);
  }
  if (filters.category && filters.category !== "all") {
    query = query.eq("category_key", filters.category);
  }
  if (filters.search?.trim()) {
    // Échappe les caractères joker de PostgREST pour qu'une recherche
    // contenant % ou _ reste une recherche littérale.
    const term = filters.search.trim().replace(/[%_,()]/g, " ");
    query = query.or(
      `title.ilike.%${term}%,venue.ilike.%${term}%,city.ilike.%${term}%`
    );
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  // merge: false — PostgREST ne sait pas qu'`organizers` est une relation
  // to-one et l'infère comme un tableau ; on impose la forme réelle.
  const { data, error } = await query.overrideTypes<
    EventSummary[],
    { merge: false }
  >();
  if (error) throw new Error(`Lecture des événements impossible : ${error.message}`);
  return data ?? [];
}

export async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .maybeSingle()
    .overrideTypes<EventDetail | null, { merge: false }>();

  if (error) throw new Error(`Lecture de l'événement impossible : ${error.message}`);
  if (!data) return null;

  data.ticket_types.sort((a, b) => a.sort - b.sort);
  return data;
}

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("key, emoji, label_fr, label_en, sort")
    .order("sort");

  if (error) throw new Error(`Lecture des catégories impossible : ${error.message}`);
  return data ?? [];
}

/** Villes ayant au moins un événement publié à venir, pour le filtre. */
export async function listCities(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("city")
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString());

  if (error) throw new Error(`Lecture des villes impossible : ${error.message}`);
  return [...new Set((data ?? []).map((row) => row.city))].sort();
}

export async function listOrganizers(limit = 6): Promise<EventOrganizer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, slug, glyph, gradient, verified")
    .order("followers_count", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Lecture des organisateurs impossible : ${error.message}`);
  return data ?? [];
}

/** Prix d'entrée affiché sur une vignette : le type de billet le moins cher. */
export function lowestPrice(event: EventSummary): number {
  return event.ticket_types.reduce(
    (min, t) => Math.min(min, t.price_xaf),
    Number.POSITIVE_INFINITY
  );
}
