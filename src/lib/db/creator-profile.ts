import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import type { CreatorSocial, SocialNetwork } from "./creator-networks";

/**
 * La carte de visite d'un creator.
 *
 * Ce qui vit ici est PUBLIC entre comptes connectés : un organisateur
 * choisit qui portera son événement, il doit pouvoir regarder avant de
 * décider. Rien de personnel n'y entre — ni e-mail, ni téléphone, ni
 * numéro de versement, qui restent dans spot.profiles sous la RLS du
 * propriétaire.
 *
 * Les nombres d'abonnés sont DÉCLARÉS. SPOT n'est branché à aucune API
 * de réseau social : les écrans qui les affichent doivent le dire, sans
 * quoi un chiffre saisi à la main passerait pour une mesure.
 */

export type { CreatorSocial, SocialNetwork } from "./creator-networks";

export type CreatorProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  city: string | null;
  glyph: string | null;
  gradient: string | null;
  verified: boolean;
  socials: CreatorSocial[];
  /** Somme des audiences déclarées, tous réseaux confondus. */
  totalFollowers: number;
};

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string;
  bio_fr: string | null;
  bio_en: string | null;
  city: string | null;
  glyph: string | null;
  gradient: string | null;
  verified: boolean;
  creator_socials: {
    network: SocialNetwork;
    handle: string;
    followers_count: number;
  }[];
};

const SELECT =
  `id, handle, display_name, bio_fr, bio_en, city, glyph, gradient, verified,
   creator_socials ( network, handle, followers_count )`;

/** Ordre d'affichage : la plus grosse audience d'abord. */
function toProfile(row: ProfileRow, locale: string): CreatorProfile {
  const socials = [...row.creator_socials]
    .map((social) => ({
      network: social.network,
      handle: social.handle,
      followersCount: social.followers_count,
    }))
    .sort((a, b) => b.followersCount - a.followersCount);

  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    bio: (locale === "en" ? row.bio_en : row.bio_fr) ?? row.bio_fr ?? row.bio_en,
    city: row.city,
    glyph: row.glyph,
    gradient: row.gradient,
    verified: row.verified,
    socials,
    totalFollowers: socials.reduce((n, s) => n + s.followersCount, 0),
  };
}

/** Profil creator de l'utilisateur courant, ou null s'il n'en a pas encore. */
export async function getMyCreatorProfile(
  locale: string
): Promise<CreatorProfile | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select(SELECT)
    .eq("id", user.id)
    .maybeSingle()
    .overrideTypes<ProfileRow | null, { merge: false }>();

  if (error) throw new Error(`Lecture du profil creator impossible : ${error.message}`);
  return data ? toProfile(data, locale) : null;
}

/** Profil creator par son pseudo public. */
export async function getCreatorProfileByHandle(
  handle: string,
  locale: string
): Promise<CreatorProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select(SELECT)
    .eq("handle", handle)
    .maybeSingle()
    .overrideTypes<ProfileRow | null, { merge: false }>();

  if (error) throw new Error(`Lecture du profil creator impossible : ${error.message}`);
  return data ? toProfile(data, locale) : null;
}

/**
 * Profils des creators d'une liste, pour les montrer à l'organisateur.
 *
 * creator_profiles_select_all ouvre la lecture à tout compte connecté :
 * pas besoin de service_role, contrairement à spot.profiles dont seul le
 * propriétaire lit la ligne.
 */
export async function listCreatorProfiles(
  ids: string[],
  locale: string
): Promise<Map<string, CreatorProfile>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_profiles")
    .select(SELECT)
    .in("id", unique)
    .overrideTypes<ProfileRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des profils creators impossible : ${error.message}`);

  return new Map((data ?? []).map((row) => [row.id, toProfile(row, locale)]));
}
