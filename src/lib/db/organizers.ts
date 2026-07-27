import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { listOrganizers, type EventOrganizer } from "./events";

export type HomeOrganizer = EventOrganizer & { following: boolean };

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
