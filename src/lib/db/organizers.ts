import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { listOrganizers, type EventOrganizer } from "./events";

export type HomeOrganizer = EventOrganizer & { following: boolean };

export type PublicOrganizer = EventOrganizer & {
  bio_fr: string | null;
  bio_en: string | null;
  followers_count: number;
  following: boolean;
};

export type OrganizerEvent = {
  id: string;
  slug: string;
  title: string;
  city: string;
  venue: string;
  starts_at: string;
  glyph: string | null;
  gradient: string | null;
  poster_path: string | null;
  ticket_types: { price_xaf: number }[];
};

export type HomeOrganizers = {
  organizers: HomeOrganizer[];
  /** Vrai si la liste est celle des abonnements, faux s'il s'agit de suggestions. */
  followed: boolean;
};

/**
 * Bloc « organisateurs » de l'accueil.
 *
 * Les abonnements de l'utilisateur d'abord ; à défaut (visiteur anonyme ou
 * personne de suivi), les organisateurs les plus suivis en suggestion. La
 * RLS (policy follows_select_own) restreint déjà la lecture aux siens :
 * inutile de filtrer sur user_id, c'est la base qui fait autorité.
 */
export async function listHomeOrganizers(limit = 4): Promise<HomeOrganizers> {
  const user = await getUser();

  if (user) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("follows")
      .select("organizers ( id, name, slug, glyph, gradient, verified )")
      .order("created_at", { ascending: false })
      .limit(limit)
      .overrideTypes<{ organizers: EventOrganizer }[], { merge: false }>();

    if (error) {
      throw new Error(`Lecture des abonnements impossible : ${error.message}`);
    }

    const followed = (data ?? []).map((row) => row.organizers);
    if (followed.length > 0) {
      return {
        organizers: followed.map((o) => ({ ...o, following: true })),
        followed: true,
      };
    }
  }

  const suggestions = await listOrganizers(limit);
  return {
    organizers: suggestions.map((o) => ({ ...o, following: false })),
    followed: false,
  };
}

/** Fiche publique d'un organisateur, avec l'état d'abonnement du visiteur. */
export async function getOrganizerBySlug(
  slug: string
): Promise<PublicOrganizer | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizers")
    .select(
      "id, name, slug, glyph, gradient, verified, bio_fr, bio_en, followers_count"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Lecture de l'organisateur impossible : ${error.message}`);
  if (!data) return null;

  return { ...data, following: await isFollowing(data.id) };
}

/**
 * Le visiteur suit-il cet organisateur ?
 *
 * La policy follows_select_own borne déjà la lecture aux siens ; un
 * visiteur anonyme ne voit rien, d'où le faux immédiat.
 */
async function isFollowing(organizerId: string): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();
  const { count } = await supabase
    .from("follows")
    .select("organizer_id", { count: "exact", head: true })
    .eq("organizer_id", organizerId);

  return (count ?? 0) > 0;
}

const ORGANIZER_EVENT_COLUMNS =
  "id, slug, title, city, venue, starts_at, glyph, gradient, poster_path, ticket_types ( price_xaf )";

/**
 * Événements publiés d'un organisateur, séparés en « à venir » et
 * « historique » — les deux sections de la maquette.
 */
export async function listOrganizerEvents(organizerId: string): Promise<{
  upcoming: OrganizerEvent[];
  past: OrganizerEvent[];
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(ORGANIZER_EVENT_COLUMNS)
    .eq("organizer_id", organizerId)
    .eq("status", "published")
    .order("starts_at", { ascending: true })
    .overrideTypes<OrganizerEvent[], { merge: false }>();

  if (error) throw new Error(`Lecture des événements impossible : ${error.message}`);

  const now = Date.now();
  const upcoming: OrganizerEvent[] = [];
  const past: OrganizerEvent[] = [];

  for (const event of data ?? []) {
    if (new Date(event.starts_at).getTime() >= now) upcoming.push(event);
    else past.push(event);
  }

  // L'historique se lit du plus récent au plus ancien.
  past.reverse();
  return { upcoming, past };
}
