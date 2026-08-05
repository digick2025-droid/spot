"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_NETWORKS } from "./creator-networks";
import type { CreatorProfileFormState } from "./creator-profile-state";

/**
 * Profil creator — écritures.
 *
 * Tout passe sous l'identité du creator : creator_profiles_insert_own et
 * creator_socials_write_own vérifient déjà que la ligne est la sienne,
 * il n'y a rien à faire en service_role. « Vérifié » ne se donne pas
 * soi-même — un déclencheur en base le remet à sa valeur précédente pour
 * qui n'est pas admin, quoi que le formulaire envoie.
 */

const profileSchema = z.object({
  // Même expression que la contrainte en base, pour dire la règle dans
  // la langue de l'intéressé plutôt qu'en erreur Postgres.
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/),
  displayName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(400).optional(),
  city: z.string().trim().max(60).optional(),
});

/**
 * Crée ou met à jour la carte de visite du creator courant.
 *
 * La bio est enregistrée dans la langue de l'écran : un creator
 * camerounais écrit sa présentation une fois, et rien ne justifie de lui
 * demander deux versions avant qu'il ait un public anglophone.
 */
export async function saveCreatorProfile(
  _state: CreatorProfileFormState,
  formData: FormData
): Promise<CreatorProfileFormState> {
  const t = await getTranslations("creatorProfile");
  const profile = await requireProfile();

  const parsed = profileSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? undefined,
    city: formData.get("city") ?? undefined,
  });
  if (!parsed.success) return { error: t("errors.invalid") };

  const locale = formData.get("locale") === "en" ? "en" : "fr";
  const supabase = await createClient();

  const { error } = await supabase.from("creator_profiles").upsert(
    {
      id: profile.id,
      handle: parsed.data.handle,
      display_name: parsed.data.displayName,
      [locale === "en" ? "bio_en" : "bio_fr"]: parsed.data.bio || null,
      city: parsed.data.city || null,
    },
    { onConflict: "id" }
  );

  if (error) {
    // 23505 : le pseudo est pris. C'est la seule erreur que l'intéressé
    // peut corriger lui-même, elle mérite sa phrase.
    if (error.code === "23505") return { error: t("errors.handleTaken") };
    console.error("[creator] enregistrement du profil échoué", error);
    return { error: t("errors.unavailable") };
  }

  refresh();
  return { notice: t("saved") };
}

const socialSchema = z.object({
  network: z.enum(SOCIAL_NETWORKS),
  handle: z.string().trim().min(1).max(60),
  followers: z.coerce.number().int().min(0).max(500_000_000),
});

/**
 * Déclare (ou remplace) l'audience du creator sur un réseau.
 *
 * Le chiffre est une déclaration, pas une mesure : aucune API n'est
 * interrogée. Le plafond n'est pas une coquetterie — il empêche une
 * faute de frappe d'afficher un milliard d'abonnés.
 */
export async function saveCreatorSocial(
  _state: CreatorProfileFormState,
  formData: FormData
): Promise<CreatorProfileFormState> {
  const t = await getTranslations("creatorProfile");
  const profile = await requireProfile();

  const parsed = socialSchema.safeParse({
    network: formData.get("network"),
    handle: formData.get("handle"),
    followers: formData.get("followers") ?? 0,
  });
  if (!parsed.success) return { error: t("errors.invalidSocial") };

  const supabase = await createClient();
  const { error } = await supabase.from("creator_socials").upsert(
    {
      creator_id: profile.id,
      network: parsed.data.network,
      handle: parsed.data.handle,
      followers_count: parsed.data.followers,
    },
    { onConflict: "creator_id,network" }
  );

  if (error) {
    // 23503 : pas encore de profil creator. Le réseau n'a rien à quoi se
    // rattacher — la carte de visite se remplit d'abord.
    if (error.code === "23503") return { error: t("errors.profileFirst") };
    console.error("[creator] enregistrement du réseau échoué", error);
    return { error: t("errors.unavailable") };
  }

  refresh();
  return { notice: t("socialSaved") };
}

const removeSchema = z.enum(SOCIAL_NETWORKS);

/** Retire un réseau de la carte de visite. */
export async function removeCreatorSocial(formData: FormData) {
  const profile = await requireProfile();

  const parsed = removeSchema.safeParse(formData.get("network"));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("creator_socials")
    .delete()
    .eq("creator_id", profile.id)
    .eq("network", parsed.data);

  if (error) throw new Error(`Suppression du réseau impossible : ${error.message}`);

  refresh();
}
