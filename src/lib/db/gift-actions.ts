"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { claimGift } from "./gifts";
import type { GiftState } from "./gift-state";

/**
 * Réclamation d'un billet offert.
 *
 * Traitée comme un point d'entrée public : le code arrive du formulaire,
 * mais l'identité du réclamant vient de la session revérifiée ici — pas
 * du navigateur. `requireProfile` crée au besoin le profil SPOT : celui
 * qui ouvre un cadeau vient souvent de créer son compte pour l'occasion,
 * et le billet doit pouvoir se rattacher à quelqu'un.
 *
 * Le succès sort par une redirection vers le billet : il n'y a rien à
 * relire sur la page de cadeau une fois qu'il est à soi.
 */
export async function claimGiftAction(
  _state: GiftState,
  formData: FormData
): Promise<GiftState> {
  const code = formData.get("code");
  if (typeof code !== "string" || code.length === 0) {
    return { error: "GIFT_NOT_FOUND" };
  }

  const profile = await requireProfile();
  const result = await claimGift(code, profile.id);

  if (!result.ok) {
    return { error: result.reason };
  }

  const locale = await getLocale();
  return redirect({ href: `/billets/${result.ticketId}`, locale });
}
