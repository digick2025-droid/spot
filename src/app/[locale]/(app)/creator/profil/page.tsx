import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { AudienceIcon, ProfileIcon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { requireProfile } from "@/lib/auth/dal";
import { getMyCreatorProfile } from "@/lib/db/creator-profile";
import { CreatorProfileForm } from "./profile-form";
import { CreatorSocialsForm } from "./socials-form";

/**
 * La carte de visite du creator.
 *
 * Deux blocs qui ne se mélangent pas : qui l'on est, et quelle audience
 * on apporte. Le second est ce qu'un organisateur regarde en premier —
 * d'où le total en grand, et la mention qu'il s'agit d'une déclaration.
 */
export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireProfile();
  const activeLocale = await getLocale();
  const t = await getTranslations("creatorProfile");

  const profile = await getMyCreatorProfile(activeLocale);

  return (
    <main className="relative flex-1 overflow-hidden">
      <span
        aria-hidden
        className="halo inset-x-0 -top-24 h-[300px] opacity-35"
        style={{ "--halo": "var(--grad-night)" } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        <h1 className="font-display text-[30px] font-extrabold uppercase">
          {t("title")}
        </h1>
        <p className="mt-2 text-[13px] text-mist">{t("lede")}</p>

        {/* ── Audience déclarée ─────────────────────────────────────── */}
        <section className="sheen mt-6 rounded-sheet bg-surface-high p-6">
          <div className="flex items-center gap-4">
            <Sticker tone="night" size="lg">
              <AudienceIcon size={26} strokeWidth={2.2} />
            </Sticker>
            <div>
              <p className="text-[12px] text-mist">{t("totalFollowers")}</p>
              <p className="font-display text-[38px] font-extrabold leading-none">
                {(profile?.totalFollowers ?? 0).toLocaleString("fr-FR")}
              </p>
            </div>
          </div>
          {/* Dit une fois, clairement : ces chiffres ne sont pas mesurés. */}
          <p className="mt-4 text-[12px] text-smoke">{t("declaredHint")}</p>

          <CreatorSocialsForm socials={profile?.socials ?? []} />
        </section>

        {/* ── Qui l'on est ──────────────────────────────────────────── */}
        <section className="sheen mt-8 rounded-sheet bg-surface p-6">
          <div className="flex items-center gap-3">
            <ProfileIcon size={18} strokeWidth={2.2} aria-hidden />
            <h2 className="font-display text-[17px] font-extrabold">
              {t("cardTitle")}
            </h2>
          </div>
          <p className="mt-2 text-[13px] text-mist">{t("cardHint")}</p>

          <CreatorProfileForm profile={profile} />
        </section>
      </div>
    </main>
  );
}
