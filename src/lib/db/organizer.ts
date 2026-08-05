import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";

export type MyOrganizer = {
  id: string;
  name: string;
  slug: string;
  glyph: string | null;
  gradient: string | null;
  followers_count: number;
  verified: boolean;
};

export type MyEvent = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  status: "draft" | "published" | "cancelled" | "ended";
  glyph: string | null;
  gradient: string | null;
  sold: number;
  capacity: number;
  revenue_xaf: number;
};

export type OrganizerDashboard = {
  organizer: MyOrganizer;
  events: MyEvent[];
  published: number;
  sold: number;
  revenue_xaf: number;
};

/**
 * Fiche organisateur de l'utilisateur courant, ou null s'il n'en a pas.
 *
 * Le modèle autorise plusieurs fiches par compte ; l'espace organisateur
 * de la Phase 1 n'en pilote qu'une, la première par ordre de création.
 */
export async function getMyOrganizer(): Promise<MyOrganizer | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, slug, glyph, gradient, followers_count, verified")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Lecture de l'organisateur impossible : ${error.message}`);
  return data;
}

type EventRow = {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  status: MyEvent["status"];
  glyph: string | null;
  gradient: string | null;
  ticket_types: { price_xaf: number; quantity_total: number; quantity_sold: number }[];
};

/**
 * Tableau de bord : la fiche, ses événements et les cumuls.
 *
 * Les ventes sont lues sur ticket_types.quantity_sold, que seule
 * mark_order_paid incrémente : un panier abandonné ou un paiement échoué
 * n'apparaît donc jamais dans les revenus.
 */
export async function getOrganizerDashboard(): Promise<OrganizerDashboard | null> {
  const organizer = await getMyOrganizer();
  if (!organizer) return null;

  const supabase = await createClient();

  // La RLS (events_select_own) borne déjà la lecture aux événements dont
  // l'utilisateur possède l'organisateur ; le filtre explicite garde la
  // requête juste si elle change un jour d'exécutant.
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, slug, title, starts_at, status, glyph, gradient, ticket_types ( price_xaf, quantity_total, quantity_sold )"
    )
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false })
    .overrideTypes<EventRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des événements impossible : ${error.message}`);

  const events: MyEvent[] = (data ?? []).map((event) => {
    const sold = event.ticket_types.reduce((n, t) => n + t.quantity_sold, 0);
    const capacity = event.ticket_types.reduce((n, t) => n + t.quantity_total, 0);
    const revenue = event.ticket_types.reduce(
      (n, t) => n + t.quantity_sold * t.price_xaf,
      0
    );
    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      starts_at: event.starts_at,
      status: event.status,
      glyph: event.glyph,
      gradient: event.gradient,
      sold,
      capacity,
      revenue_xaf: revenue,
    };
  });

  return {
    organizer,
    events,
    published: events.filter((e) => e.status === "published").length,
    sold: events.reduce((n, e) => n + e.sold, 0),
    revenue_xaf: events.reduce((n, e) => n + e.revenue_xaf, 0),
  };
}

export type MyEventTier = {
  id: string;
  name: string;
  price_xaf: number;
  quantity_total: number;
  quantity_sold: number;
  sort: number;
};

export type MyEventDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  city: string;
  venue: string;
  starts_at: string;
  category_key: string | null;
  glyph: string | null;
  poster_path: string | null;
  status: MyEvent["status"];
  tiers: MyEventTier[];
};

type EventDetailRow = {
  id: string;
  slug: string;
  title: string;
  description_fr: string | null;
  city: string;
  venue: string;
  starts_at: string;
  category_key: string | null;
  glyph: string | null;
  poster_path: string | null;
  status: MyEvent["status"];
  ticket_types: {
    id: string;
    name_fr: string;
    price_xaf: number;
    quantity_total: number;
    quantity_sold: number;
    sort: number;
  }[];
};

/**
 * Un événement de l'organisateur courant, prêt pour le formulaire d'édition.
 *
 * La RLS (events_select_own) borne déjà la lecture à ses propres
 * événements ; le filtre organizer_id explicite garde la requête juste
 * si elle change un jour d'exécutant.
 */
export async function getMyEvent(id: string): Promise<MyEventDetail | null> {
  const organizer = await getMyOrganizer();
  if (!organizer) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, slug, title, description_fr, city, venue, starts_at, category_key, glyph, poster_path, status, ticket_types ( id, name_fr, price_xaf, quantity_total, quantity_sold, sort )"
    )
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .maybeSingle()
    .overrideTypes<EventDetailRow | null, { merge: false }>();

  if (error) throw new Error(`Lecture de l'événement impossible : ${error.message}`);
  if (!data) return null;

  const tiers = [...data.ticket_types]
    .sort((a, b) => a.sort - b.sort)
    .map((tier) => ({
      id: tier.id,
      name: tier.name_fr,
      price_xaf: tier.price_xaf,
      quantity_total: tier.quantity_total,
      quantity_sold: tier.quantity_sold,
      sort: tier.sort,
    }));

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description_fr,
    city: data.city,
    venue: data.venue,
    starts_at: data.starts_at,
    category_key: data.category_key,
    glyph: data.glyph,
    poster_path: data.poster_path,
    status: data.status,
    tiers,
  };
}
