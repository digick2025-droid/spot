import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { signOut } from "@/lib/auth/actions";

/**
 * Écran Profil — version minimale : identité et déconnexion.
 * L'édition du nom, du téléphone et de la langue viendra avec le reste de
 * l'espace participant.
 */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const profile = await requireProfile();
  const t = await getTranslations("app");
  const tAuth = await getTranslations("auth");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
        {t("profile")}
      </h1>

      <div className="mt-6 flex items-center gap-4 rounded-[20px] border border-white/10 bg-card p-5">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-2xl"
        >
          👤
        </span>
        <div className="min-w-0">
          <p className="font-display truncate text-[15px] font-extrabold">
            {profile.full_name ?? profile.email}
          </p>
          {profile.full_name && (
            <p className="mt-0.5 truncate text-[13px] text-mist">
              {profile.email}
            </p>
          )}
        </div>
      </div>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-2xl border border-white/10 bg-card px-5 py-3.5 font-display text-[14px] font-extrabold text-danger transition-colors hover:border-danger/50"
        >
          {tAuth("signOut")}
        </button>
      </form>
    </main>
  );
}
