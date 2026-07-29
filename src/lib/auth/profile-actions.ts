"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { PaymentError, normalizeCameroonPhone } from "@/lib/payments";
import { routing } from "@/i18n/routing";
import { requireProfile } from "./dal";
import type { ProfileState } from "./profile-state";

const schema = z.object({
  fullName: z.string().trim().max(80),
  phone: z.string().trim().max(20),
  locale: z.enum(routing.locales),
});

/**
 * Met à jour le profil du participant.
 *
 * Point d'entrée public : la session est revérifiée ici, et la policy
 * profiles_update_own interdit d'écrire sur la ligne d'autrui — l'`eq`
 * sur l'identifiant n'est qu'une ceinture de plus.
 */
export async function updateProfile(
  _state: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const t = await getTranslations("account");
  const profile = await requireProfile();

  const parsed = schema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    locale: formData.get("locale"),
  });
  if (!parsed.success) return { error: t("errors.invalid") };

  // Le téléphone reste facultatif ; s'il est saisi, il est normalisé au
  // même format que celui du paiement pour qu'un seul numéro circule.
  let phone: string | null = null;
  if (parsed.data.phone !== "") {
    try {
      phone = normalizeCameroonPhone(parsed.data.phone);
    } catch (error) {
      if (error instanceof PaymentError) return { error: t("errors.phone") };
      throw error;
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName || null,
      phone,
      locale: parsed.data.locale,
    })
    .eq("id", profile.id);

  if (error) {
    console.error("[compte] mise à jour du profil échouée", error);
    return { error: t("errors.unavailable") };
  }

  // La langue choisie est celle du profil : si elle change, on rejoue
  // l'écran dans cette langue plutôt que de laisser l'URL contredire le
  // réglage qu'on vient d'enregistrer.
  const currentLocale = await getLocale();
  if (parsed.data.locale !== currentLocale) {
    return redirect({ href: "/compte", locale: parsed.data.locale });
  }

  // Même URL : sans rafraîchissement, l'en-tête de la page continuerait
  // d'afficher l'ancien nom.
  refresh();
  return { notice: t("saved") };
}
