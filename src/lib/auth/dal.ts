import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export type UserRole = "participant" | "organizer" | "creator" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  locale: Locale;
  /**
   * Numéro Mobile Money de destination des versements. Distinct de
   * `phone`, qui est un contact : on n'envoie pas de l'argent sur un
   * numéro saisi pour tout autre chose.
   */
  payout_phone: string | null;
};

const PROFILE_COLUMNS = "id, email, full_name, phone, role, locale, payout_phone";

/**
 * Couche d'accès aux données.
 *
 * Toute Server Action et tout Route Handler qui touche à des données d'un
 * utilisateur passe par ici : la vérification d'autorisation se fait au
 * plus près de la donnée, jamais seulement dans le proxy (qui n'est qu'un
 * filtre optimiste) ni dans un layout (qui ne se rejoue pas à chaque
 * navigation).
 */

/** Utilisateur authentifié, ou null. Mémoïsé sur la passe de rendu. */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

/** Profil SPOT de l'utilisateur courant, ou null s'il n'est pas connecté. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
});

/** Exige une session ; redirige vers la connexion sinon. */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) {
    const locale = await getLocale();
    return redirect({ href: "/connexion", locale });
  }
  return user;
}

/**
 * Exige une session ET un profil SPOT, en le créant au besoin.
 *
 * Le profil est créé paresseusement ici plutôt que par un trigger sur
 * auth.users : cette table est partagée avec une autre application, on ne
 * veut pas lui greffer d'effet de bord (ni créer un profil SPOT pour ses
 * utilisateurs à elle).
 */
export async function requireProfile(): Promise<Profile> {
  const user = await requireUser();
  const existing = await getProfile();
  if (existing) return existing;

  const supabase = await createClient();
  const locale = await getLocale();

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      phone: user.phone ?? null,
      locale,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    // Course entre deux requêtes concurrentes : le profil vient d'être créé
    // par l'autre. On relit.
    const { data: raced } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();

    if (raced) return raced as Profile;
    throw new Error(`Création du profil SPOT impossible : ${error.message}`);
  }

  return data as Profile;
}

/**
 * Exige un profil de rôle « admin ».
 *
 * Un simple connecté reçoit un 404, pas un 403 : la console n'a pas à
 * confirmer son existence à qui n'y a pas droit. Le refus n'est de toute
 * façon pas ici l'essentiel — les fonctions spot.admin_* refusent
 * elles-mêmes un appelant non administrateur, cette garde n'évite qu'un
 * écran vide.
 */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") notFound();
  return profile;
}

/**
 * L'utilisateur a-t-il rejoint au moins une campagne d'affiliation ?
 *
 * `profiles.role` ne répond pas à cette question : la colonne existe mais
 * personne ne l'écrit — devenir creator, c'est rejoindre une campagne, et
 * c'est cet état-là qui fait foi. La lecture passe par la RLS
 * (creator_links_select_own), donc un anonyme voit zéro.
 *
 * Sert à décider des onglets affichés, jamais d'un droit : `/creator`
 * vérifie pour son propre compte.
 */
export const isCreator = cache(async (): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;

  const supabase = await createClient();
  const { count } = await supabase
    .from("creator_links")
    .select("id", { count: "exact", head: true });

  return (count ?? 0) > 0;
});

/**
 * Organisateurs appartenant à l'utilisateur courant.
 * Vide s'il n'en gère aucun — appelant responsable du refus.
 */
export const getOwnedOrganizers = cache(async () => {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizers")
    .select("id, name, slug, glyph, gradient")
    .eq("owner_id", user.id)
    .order("name");

  return data ?? [];
});
