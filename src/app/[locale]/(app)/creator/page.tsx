import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import {
  getCreatorSpace,
  getSiteOrigin,
  type CampaignStatus,
  type CreatorCampaign,
  type CreatorPayout,
  type PayoutStatus,
} from "@/lib/db/affiliation";
import { formatEventDateShort, formatPriceXaf } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";
import { PayoutPhoneForm } from "./payout-phone-form";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#8B5CF6)";

const STATUS_KEY: Record<CampaignStatus, string> = {
  active: "statusActive",
  paused: "statusPaused",
  ended: "statusEnded",
};

const STATUS_STYLE: Record<CampaignStatus, string> = {
  active: "bg-brand/15 text-brand",
  paused: "bg-warning/15 text-warning",
  ended: "bg-white/10 text-mist",
};

const PAYOUT_KEY: Record<PayoutStatus, string> = {
  pending: "payoutPending",
  paid: "payoutPaid",
  failed: "payoutFailed",
};

const PAYOUT_STYLE: Record<PayoutStatus, string> = {
  pending: "text-warning",
  paid: "text-success",
  failed: "text-danger",
};

/**
 * Espace Creator — écran sombre de la maquette.
 *
 * Les gains affichés sont ceux que la base a figés à l'encaissement
 * (spot.commissions) : ni une estimation, ni un cumul de clics.
 */
export default async function CreatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireProfile();
  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("affiliation");
  const tApp = await getTranslations("app");

  const [space, origin] = await Promise.all([getCreatorSpace(), getSiteOrigin()]);
  const prefix = activeLocale === routing.defaultLocale ? "" : `/${activeLocale}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
        {tApp("infSpace")}
      </h1>

      {space.campaigns.length === 0 ? (
        <div className="mt-8 rounded-[20px] border border-white/10 bg-card p-8 text-center">
          <div className="text-4xl" aria-hidden>
            📣
          </div>
          <p className="mt-4 text-[15px] font-semibold">{t("creatorEmpty")}</p>
          <p className="mt-2 text-[13px] text-mist">{t("creatorEmptyHint")}</p>
          <Link
            href="/decouvrir"
            className="mt-5 inline-block rounded-2xl bg-brand px-5 py-3 font-display text-[14px] font-extrabold text-white hover:opacity-90"
          >
            {tApp("explore")}
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-[24px] border border-accent/40 bg-card p-6">
            <p className="text-[12px] text-mist">{tApp("totalEarnings")}</p>
            <p className="font-display mt-1 text-4xl font-extrabold leading-none text-brand">
              {formatPriceXaf(space.totalEarningsXaf)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat label={tApp("clicks")} value={`${space.totalClicks}`} />
              <Stat label={t("sales")} value={`${space.totalSales}`} />
              <Stat
                label={t("toReceive")}
                value={formatPriceXaf(space.totalDueXaf + space.totalPendingXaf)}
              />
              <Stat label={t("paidOut")} value={formatPriceXaf(space.totalPaidXaf)} />
            </div>
          </section>

          {/* ── Versements ───────────────────────────────────────── */}
          <section className="mt-8 rounded-[22px] border border-white/10 bg-card p-6">
            <h2 className="font-display text-[15px] font-extrabold">
              {t("payoutsTitle")}
            </h2>
            <p className="mt-2 text-[13px] text-mist">{t("payoutsHint")}</p>

            <PayoutPhoneForm phone={space.payoutPhone ?? ""} />

            {space.payouts.length === 0 ? (
              <p className="mt-5 text-[13px] text-mist">{t("payoutsEmpty")}</p>
            ) : (
              <ul className="mt-5 flex flex-col gap-2">
                {space.payouts.map((payout) => (
                  <li key={payout.id}>
                    <PayoutRow payout={payout} locale={activeLocale} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <h2 className="font-display mt-8 text-[15px] font-extrabold">
            {tApp("myCampaigns")}
          </h2>

          <ul className="mt-4 flex flex-col gap-4">
            {space.campaigns.map((campaign) => (
              <li key={campaign.linkId}>
                <CampaignCard
                  campaign={campaign}
                  locale={activeLocale}
                  promoUrl={`${origin}${prefix}/r/${campaign.code}`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

async function CampaignCard({
  campaign,
  locale,
  promoUrl,
}: {
  campaign: CreatorCampaign;
  locale: Locale;
  promoUrl: string;
}) {
  const t = await getTranslations("affiliation");
  const tApp = await getTranslations("app");

  const rule =
    campaign.commissionKind === "percent"
      ? t("rulePercent", { value: campaign.commissionValue })
      : t("ruleFixed", { value: campaign.commissionValue });

  return (
    <article className="rounded-[22px] border border-white/10 bg-card p-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/evenements/${campaign.event.slug}`}
          aria-hidden
          tabIndex={-1}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{ background: campaign.event.gradient ?? FALLBACK_GRADIENT }}
        >
          {campaign.event.glyph ?? "🎟"}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/evenements/${campaign.event.slug}`}
            className="font-display block truncate text-[15px] font-extrabold hover:text-brand"
          >
            {campaign.event.title}
          </Link>
          <p className="mt-0.5 truncate text-[12px] text-mist">
            {campaign.event.city} ·{" "}
            {formatEventDateShort(campaign.event.starts_at, locale)} · {rule}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${STATUS_STYLE[campaign.status]}`}
        >
          {t(STATUS_KEY[campaign.status])}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label={tApp("clicks")} value={`${campaign.clicks}`} dark />
        <Stat label={t("sales")} value={`${campaign.sales}`} dark />
        <Stat
          label={t("kindLabel")}
          value={formatPriceXaf(campaign.earningsXaf)}
          dark
          accent
        />
      </div>

      <p className="mt-4 text-[11px] text-mist">{tApp("yourLink")}</p>
      <div className="mt-2 flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-full border border-dashed border-white/20 bg-ink px-4 py-3 text-[12px] text-brand">
          {promoUrl}
        </code>
        <CopyButton
          value={promoUrl}
          className="shrink-0 rounded-full border border-white/20 px-4 text-[12px] font-bold hover:border-brand hover:text-brand"
        />
      </div>
      <p className="mt-2 text-[12px] text-mist">
        {campaign.status === "active" ? t("linkHint") : t("linkClosed")}
      </p>
    </article>
  );
}

/** Une ligne d'historique de versement, du point de vue du creator. */
async function PayoutRow({
  payout,
  locale,
}: {
  payout: CreatorPayout;
  locale: Locale;
}) {
  const t = await getTranslations("affiliation");

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-ink px-4 py-3 text-[12px]">
      <span className="font-mono text-smoke">{payout.reference}</span>
      <span className="min-w-0 flex-1 truncate text-mist">{payout.eventTitle}</span>
      <span className="font-display text-[14px] font-extrabold">
        {formatPriceXaf(payout.amountXaf)}
      </span>
      <span className={`font-semibold ${PAYOUT_STYLE[payout.status]}`}>
        {t(PAYOUT_KEY[payout.status])}
      </span>
      <span className="w-full text-[11px] text-smoke">
        {formatEventDateShort(payout.paidAt ?? payout.createdAt, locale)}
        {payout.status === "failed" && ` · ${t("payoutFailedHint")}`}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  dark,
  accent,
}: {
  label: string;
  value: string;
  dark?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${dark ? "bg-ink" : "bg-white/10"}`}>
      <div className="text-[11px] text-mist">{label}</div>
      <div
        className={`font-display mt-1.5 text-[19px] font-extrabold ${accent ? "text-brand" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
