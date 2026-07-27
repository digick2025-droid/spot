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
      "id, slug, title, starts_at, status, glyph, ticket_types ( price_xaf, quantity_total, quantity_sold )"
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
