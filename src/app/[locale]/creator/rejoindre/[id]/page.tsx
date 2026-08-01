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
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="font-display text-2xl font-extrabold">{t("notFound")}</h1>
        <p className="mt-2 text-[14px] text-mist">{t("notFoundHint")}</p>
        <Link
          href="/decouvrir"
          className="mt-5 inline-block rounded-2xl bg-brand px-5 py-3 font-display text-[14px] font-extrabold text-white hover:opacity-90"
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <h1 className="font-display text-2xl font-extrabold">{t("joinTitle")}</h1>

      <section className="mt-6 rounded-[22px] border border-white/10 bg-card p-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{ background: campaign.event.gradient ?? FALLBACK_GRADIENT }}
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

        <div className="mt-5 rounded-2xl bg-ink p-4">
          <p className="text-[11px] text-mist">{campaign.name}</p>
          <p className="font-display mt-1 text-[19px] font-extrabold text-brand">
            {rule}
          </p>
        </div>

        {campaign.alreadyJoined ? (
          <>
            <p className="mt-5 text-[14px] font-semibold">{t("alreadyJoined")}</p>
            <Link
              href="/creator"
              className="mt-4 inline-block rounded-2xl bg-brand px-5 py-3 font-display text-[14px] font-extrabold text-white hover:opacity-90"
            >
              {t("seeMyLink")}
            </Link>
          </>
        ) : campaign.status !== "active" ? (
          <p className="mt-5 text-[14px] text-mist">{t("errors.campaignClosed")}</p>
        ) : (
          <>
            <p className="mt-5 text-[13px] text-mist">{t("joinHint")}</p>
            <JoinForm campaignId={campaign.id} />
          </>
        )}
      </section>
    </main>
  );
}
