import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { getJoinableCampaign } from "@/lib/db/affiliation";
import { formatEventDate } from "@/lib/format";
import { JoinForm } from "./join-form";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#8B5CF6)";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Invitation à une campagne.
 *
 * L'identifiant de campagne tient lieu d'invitation : il n'est pas
 * devinable, et l'organisateur choisit à qui il l'envoie. La page exige
 * une session — sans profil, il n'y a personne à qui rattacher un lien.
 */
export default async function JoinCampaignPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const profile = await requireProfile();
  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("affiliation");
  const tApp = await getTranslations("app");

  const campaign = UUID_PATTERN.test(id)
    ? await getJoinableCampaign(id, profile.id)
    : null;

  if (!campaign) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10 pt-8">
        <h1 className="font-display text-2xl font-extrabold">{t("notFound")}</h1>
        <p className="mt-2 text-[14px] text-mist">{t("notFoundHint")}</p>
        <Link
          href="/decouvrir"
          className="press grad-ember glow-brand font-display mt-6 inline-block rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white"
        >
          {tApp("explore")}
        </Link>
      </main>
    );
  }

  const rule =
    campaign.commissionKind === "percent"
      ? t("rulePercent", { value: campaign.commissionValue })
      : t("ruleFixed", { value: campaign.commissionValue });

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* L'invitation reste une invitation : la couleur de l'événement
          l'accompagne, comme sur un carton. */}
      <span
        aria-hidden
        className="halo inset-x-0 -top-20 h-[260px] opacity-35"
        style={
          {
            "--halo": campaign.event.gradient ?? FALLBACK_GRADIENT,
          } as React.CSSProperties
        }
      />

      <div className="relative mx-auto w-full max-w-2xl px-5 pb-10 pt-8">
        <h1 className="font-display text-2xl font-extrabold">
          {t("joinTitle")}
        </h1>

        <section className="sheen mt-6 rounded-sheet bg-surface p-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{
                background: campaign.event.gradient ?? FALLBACK_GRADIENT,
              }}
            >
              {campaign.event.glyph ?? "🎟"}
            </span>
            <div className="min-w-0">
              <p className="font-display truncate text-[17px] font-extrabold">
                {campaign.event.title}
              </p>
              <p className="mt-0.5 text-[12px] text-mist">
                {campaign.event.city} ·{" "}
                {formatEventDate(campaign.event.starts_at, activeLocale)}
              </p>
            </div>
          </div>

          {/* La règle de commission est ce qu'on vient lire : elle porte la
              braise, comme un prix. */}
          <div className="mt-5 rounded-2xl bg-ink p-4 ring-1 ring-inset ring-white/[0.06]">
            <p className="text-[11px] text-mist">{campaign.name}</p>
            <p className="text-ember font-display mt-1 text-[19px] font-extrabold">
              {rule}
            </p>
          </div>

          {campaign.alreadyJoined ? (
            <>
              <p className="mt-5 text-[14px] font-semibold">
                {t("alreadyJoined")}
              </p>
              <Link
                href="/creator"
                className="press grad-ember glow-brand font-display mt-4 inline-block rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white"
              >
                {t("seeMyLink")}
              </Link>
            </>
          ) : campaign.status !== "active" ? (
            <p className="mt-5 text-[14px] text-mist">
              {t("errors.campaignClosed")}
            </p>
          ) : (
            <>
              <p className="mt-5 text-[13px] text-mist">{t("joinHint")}</p>
              <JoinForm campaignId={campaign.id} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
