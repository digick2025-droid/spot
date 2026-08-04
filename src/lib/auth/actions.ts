"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import { requireProfile } from "./dal";
import { initialAuthState, type AuthState } from "./state";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);

/** Étape 1 — envoi du code à usage unique par e-mail. */
export async function requestOtp(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const t = await getTranslations("auth");
  const parsed = emailSchema.safeParse(formData.get("email") ?? "");

  if (!parsed.success) {
    return { step: "email", error: t("errors.invalidEmail") };
  }

  const email = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return {
      step: "email",
      email,
      error:
        error.status === 429
          ? t("errors.tooManyRequests")
          : t("errors.sendFailed"),
    };
  }

  return { step: "code", email, notice: t("codeSent", { email }) };
}

/** Étape 2 — vérification du code et ouverture de la session. */
export async function verifyOtp(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const t = await getTranslations("auth");

  const email = emailSchema.safeParse(formData.get("email") ?? state.email ?? "");
  const code = codeSchema.safeParse(formData.get("code") ?? "");

  if (!email.success) {
    return { step: "email", error: t("errors.invalidEmail") };
  }
  if (!code.success) {
    return { ...state, step: "code", email: email.data, error: t("errors.invalidCode") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "email",
  });

  if (error) {
    return {
      step: "code",
      email: email.data,
      error:
        error.status === 429
          ? t("errors.tooManyRequests")
          : t("errors.wrongCode"),
    };
  }

  // La session existe : on s'assure que le profil SPOT est en place avant
  // d'entrer dans l'application.
  await requireProfile();

  const locale = await getLocale();
  // redirect() lève une exception de contrôle de flux : rien ne s'exécute
  // après, et elle ne doit pas être avalée par un try/catch. On retourne
  // son résultat (`never`) pour que TypeScript voie bien la sortie.
  return redirect({ href: "/accueil", locale });
}

/** Renvoi d'un nouveau code. */
export async function resendOtp(state: AuthState): Promise<AuthState> {
  const t = await getTranslations("auth");
  const parsed = emailSchema.safeParse(state.email ?? "");

  if (!parsed.success) {
    return { step: "email", error: t("errors.invalidEmail") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return {
      step: "code",
      email: parsed.data,
      error:
        error.status === 429
          ? t("errors.tooManyRequests")
          : t("errors.sendFailed"),
    };
  }

  return { step: "code", email: parsed.data, notice: t("codeResent") };
}

/**
 * Répartiteur unique du formulaire de connexion.
 *
 * `useActionState` ne pilote qu'une seule action : l'intention voyage donc
 * dans le champ `intent` du bouton pressé. Toute valeur inconnue est
 * traitée comme un retour à l'étape e-mail plutôt que d'échouer.
 */
export async function submitAuth(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  switch (formData.get("intent")) {
    case "request":
      return requestOtp(state, formData);
    case "verify":
      return verifyOtp(state, formData);
    case "resend":
      return resendOtp(state);
    default:
      return initialAuthState;
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();
  // Vers la vitrine publique, pas vers l'accueil de l'application : sans
  // session, celui-ci n'a plus rien de personnel à montrer.
  redirect({ href: "/", locale });
}
