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
import { listOpenCreatorRequests } from "@/lib/db/balances";
import { getMyCreatorProfile } from "@/lib/db/creator-profile";
import { formatEventDateShort, formatPriceXaf } from "@/lib/format";
import { AudienceIcon, CampaignIcon, ProfileIcon, SearchIcon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { CopyButton } from "@/components/copy-button";
import { PayoutPhoneForm } from "@/components/payout-phone-form";
import { RequestPayoutForm } from "./request-payout-form";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#8B5CF6)";

const STATUS_KEY: Record<CampaignStatus, string> = {
  active: "statusActive",
  paused: "statusPaused",
  ended: "statusEnded",
};

const STATUS_STYLE: Record<CampaignStatus, string> = {
  active: "bg-brand/15 text-brand-bright",
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

  const profile = await requireProfile();
  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("affiliation");
  const tApp = await getTranslations("app");
  const tMoney = await getTranslations("money");

  const [space, origin, openRequests, creatorProfile] = await Promise.all([
    getCreatorSpace(),
    getSiteOrigin(),
    listOpenCreatorRequests(),
    getMyCreatorProfile(activeLocale),
  ]);
  const prefix = activeLocale === routing.defaultLocale ? "" : `/${activeLocale}`;

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Le créateur appartient au monde violet : c'est la nuit, pas la
          braise, qui éclaire son espace. */}
      <span
        aria-hidden
        className="halo inset-x-0 -top-24 h-[300px] opacity-35"
        style={{ "--halo": "var(--grad-night)" } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        <h1 className="font-display text-[30px] font-extrabold uppercase">
          {tApp("infSpace")}
        </h1>

        {/* Les deux portes de l'espace : trouver des campagnes, et
            soigner la carte de visite qui décide un organisateur. */}
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Link
            href="/creator/campagnes"
            className="press grad-night font-display inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0_10px_24px_-12px_rgb(139_92_246/0.9)]"
          >
            <SearchIcon size={15} strokeWidth={2.4} aria-hidden />
            {tMoney("browseCampaigns")}
          </Link>
          <Link
            href="/creator/profil"
            className="press font-display inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[13px] font-extrabold ring-1 ring-inset ring-white/12 hover:text-brand-bright"
          >
            <ProfileIcon size={15} strokeWidth={2.2} aria-hidden />
            {tMoney("myCreatorProfile")}
          </Link>
          {creatorProfile && creatorProfile.totalFollowers > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mist">
              <AudienceIcon size={14} strokeWidth={2.2} aria-hidden />
              {tMoney("followersDeclared", {
                count: creatorProfile.totalFollowers.toLocaleString("fr-FR"),
              })}
            </span>
          )}
        </div>

        {space.campaigns.length === 0 ? (
          <div className="sheen mt-8 rounded-sheet bg-surface p-8 text-center">
            <Sticker tone="night" size="lg" className="mx-auto">
              <CampaignIcon size={30} strokeWidth={2.2} />
            </Sticker>
            <p className="mt-5 text-[15px] font-semibold">{t("creatorEmpty")}</p>
            <p className="mt-2 text-[13px] text-mist">{t("creatorEmptyHint")}</p>
            {/* Vers le catalogue, pas vers la découverte : sans campagne,
                ce qui manque est une campagne à rejoindre. */}
            <Link
              href="/creator/campagnes"
              className="press grad-ember glow-brand font-display mt-6 inline-block rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white"
            >
              {tMoney("browseCampaigns")}
            </Link>
          </div>
        ) : (
          <>
            {/* Le total gagné est le chiffre qu'on vient chercher : il a
                droit à la braise et à toute la largeur. */}
            <section className="sheen mt-6 rounded-sheet bg-surface-high p-6">
              <p className="text-[12px] text-mist">{tApp("totalEarnings")}</p>
              <p className="text-ember font-display mt-1 text-[44px] font-extrabold leading-none">
                {formatPriceXaf(space.totalEarningsXaf)}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <Stat label={tApp("clicks")} value={`${space.totalClicks}`} />
                <Stat label={t("sales")} value={`${space.totalSales}`} />
                <Stat
                  label={t("toReceive")}
                  value={formatPriceXaf(
                    space.totalDueXaf + space.totalPendingXaf
                  )}
                />
                <Stat
                  label={t("paidOut")}
                  value={formatPriceXaf(space.totalPaidXaf)}
                />
              </div>
            </section>

            {/* ── Versements ───────────────────────────────────────── */}
            <section className="sheen mt-8 rounded-sheet bg-surface p-6">
              <h2 className="font-display text-[17px] font-extrabold">
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

            <h2 className="font-display mt-9 text-[17px] font-extrabold">
              {tApp("myCampaigns")}
            </h2>

            <ul className="mt-4 flex flex-col gap-3">
              {space.campaigns.map((campaign) => (
                <li key={campaign.linkId}>
                  <CampaignCard
                    campaign={campaign}
                    locale={activeLocale}
                    promoUrl={`${origin}${prefix}/r/${campaign.code}`}
                    hasPayoutPhone={profile.payout_phone !== null}
                    alreadyRequested={openRequests.has(campaign.campaignId)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

async function CampaignCard({
  campaign,
  locale,
  promoUrl,
  hasPayoutPhone,
  alreadyRequested,
}: {
  campaign: CreatorCampaign;
  locale: Locale;
  promoUrl: string;
  hasPayoutPhone: boolean;
  alreadyRequested: boolean;
}) {
  const t = await getTranslations("affiliation");
  const tApp = await getTranslations("app");

  const rule =
    campaign.commissionKind === "percent"
      ? t("rulePercent", { value: campaign.commissionValue })
      : t("ruleFixed", { value: campaign.commissionValue });

  return (
    <article className="sheen rounded-sheet bg-surface p-5">
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
            className="font-display block truncate text-[15px] font-extrabold hover:text-brand-bright"
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

      <div className="mt-4 grid grid-cols-3 gap-2.5">
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
        {/* Le lien est ce que le créateur colle dans sa story : il se lit
            d'un bloc, et le bouton de copie est aussi haut que lui. */}
        <code className="min-w-0 flex-1 truncate rounded-full bg-ink px-4 py-3 text-[12px] text-brand-bright ring-1 ring-inset ring-white/12">
          {promoUrl}
        </code>
        <CopyButton
          value={promoUrl}
          className="press shrink-0 rounded-full px-4 text-[12px] font-bold ring-1 ring-inset ring-white/15 hover:text-brand-bright"
        />
      </div>
      <p className="mt-2 text-[12px] text-mist">
        {campaign.status === "active" ? t("linkHint") : t("linkClosed")}
      </p>

      <RequestPayoutForm
        campaignId={campaign.campaignId}
        dueXaf={campaign.dueXaf}
        hasPayoutPhone={hasPayoutPhone}
        alreadyRequested={alreadyRequested}
      />
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-ink px-4 py-3 text-[12px] ring-1 ring-inset ring-white/[0.06]">
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
    <div
      className={`rounded-2xl p-4 ring-1 ring-inset ring-white/[0.06] ${
        dark ? "bg-ink" : "bg-white/[0.06]"
      }`}
    >
      <div className="text-[11px] text-mist">{label}</div>
      <div
        className={`font-display mt-1.5 text-[19px] font-extrabold ${accent ? "text-brand-bright" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
