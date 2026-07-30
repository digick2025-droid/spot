import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { getOrganizerDashboard } from "@/lib/db/organizer";
import {
  getOrganizerCampaigns,
  getSiteOrigin,
  type CampaignStatus,
  type OrganizerCampaign,
} from "@/lib/db/affiliation";
import { setCampaignStatus } from "@/lib/db/affiliation-actions";
import { formatPriceXaf } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";
import { CampaignForm } from "./campaign-form";

const STATUS_KEY: Record<CampaignStatus, string> = {
  active: "statusActive",
  paused: "statusPaused",
  ended: "statusEnded",
};

const STATUS_STYLE: Record<CampaignStatus, string> = {
  active: "bg-brand/10 text-brand",
  paused: "bg-warning/10 text-warning",
  ended: "bg-fog text-smoke",
};

/**
 * Campagnes Creator — écran clair de la maquette.
 *
 * Le tableau ne montre que ce que la RLS laisse lire : les campagnes des
 * événements de l'organisateur, et les commissions qu'il doit.
 */
export default async function CampaignsPage({
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
  const tOrganizer = await getTranslations("organizer");

  const [dashboard, campaigns, origin] = await Promise.all([
    getOrganizerDashboard(),
    getOrganizerCampaigns(),
    getSiteOrigin(),
  ]);

  // Sans fiche organisateur, il n'y a rien à promouvoir : le tableau de
  // bord sait proposer la création, cette page n'a pas à la dupliquer.
  if (!dashboard || !campaigns) {
    return (
      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <h1 className="font-display text-2xl font-extrabold">
            {tApp("campaigns")}
          </h1>
          <p className="mt-2 text-[14px] text-smoke">
            {tOrganizer("errors.noOrganizer")}
          </p>
          <Link
            href="/organisateur"
            className="mt-5 inline-block rounded-2xl bg-brand px-5 py-3 font-display text-[14px] font-extrabold text-white hover:opacity-90"
          >
            {tOrganizer("openSpace")}
          </Link>
        </div>
      </main>
    );
  }

  const publishedEvents = dashboard.events.filter((e) => e.status === "published");
  // Le préfixe suit la langue de l'organisateur : le creator invité
  // arrive dans la même que celle où le lien a été copié.
  const prefix = activeLocale === routing.defaultLocale ? "" : `/${activeLocale}`;

  return (
    <main className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <Link
          href="/organisateur"
          className="text-[13px] font-semibold text-smoke hover:text-ink"
        >
          ← {tOrganizer("backToDashboard")}
        </Link>

        <h1 className="font-display mt-4 text-2xl font-extrabold">
          {tApp("campaigns")}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-smoke">
          {tApp("promoDesc")}
        </p>

        {/* ── Ouverture d'une campagne ────────────────────────────── */}
        <section className="mt-6 rounded-[18px] border border-fog bg-paper-card p-6">
          <h2 className="font-display text-[15px] font-extrabold">
            {t("newCampaign")}
          </h2>

          {publishedEvents.length === 0 ? (
            <>
              <p className="mt-2 text-[13px] text-smoke">{t("noEventsHint")}</p>
              <Link
                href="/organisateur/evenements/nouveau"
                className="mt-4 inline-block rounded-full bg-brand px-4 py-2 font-display text-[13px] font-extrabold text-white hover:opacity-90"
              >
                + {tApp("createEvent")}
              </Link>
            </>
          ) : (
            <CampaignForm events={publishedEvents} />
          )}
        </section>

        {/* ── Campagnes ouvertes ──────────────────────────────────── */}
        {campaigns.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-fog bg-paper-card p-8 text-center">
            <p className="text-[15px] font-semibold">{t("noCampaigns")}</p>
            <p className="mt-2 text-[13px] text-smoke">{t("noCampaignsHint")}</p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <CampaignCard
                  campaign={campaign}
                  inviteUrl={`${origin}${prefix}/creator/rejoindre/${campaign.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

async function CampaignCard({
  campaign,
  inviteUrl,
}: {
  campaign: OrganizerCampaign;
  inviteUrl: string;
}) {
  const t = await getTranslations("affiliation");
  const tApp = await getTranslations("app");

  const rule =
    campaign.commissionKind === "percent"
      ? t("rulePercent", { value: campaign.commissionValue })
      : t("ruleFixed", { value: campaign.commissionValue });

  return (
    <article className="rounded-[18px] border border-fog bg-paper-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold">
            <span aria-hidden>{campaign.event.glyph ?? "🎟"}</span>{" "}
            {campaign.event.title}
          </h3>
          <p className="mt-1 text-[12px] text-smoke">
            {campaign.name} · {rule}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${STATUS_STYLE[campaign.status]}`}
        >
          {t(STATUS_KEY[campaign.status])}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat label={tApp("clicks")} value={`${campaign.clicks}`} />
        <Stat label={tApp("ticketsSold")} value={`${campaign.tickets}`} />
        <Stat
          label={tApp("commissionsDue")}
          value={formatPriceXaf(campaign.commissionXaf)}
          accent
        />
      </div>

      <h4 className="mt-5 text-[12px] text-smoke">
        {t("creators", { count: campaign.creators.length })}
      </h4>

      {campaign.creators.length === 0 ? (
        <p className="mt-2 text-[13px] text-smoke">{t("noCreators")}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {campaign.creators.map((creator) => (
            <li
              key={creator.linkId}
              className="flex items-center gap-3 rounded-[14px] bg-paper px-4 py-3"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-extrabold text-white"
              >
                {creator.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">
                  {creator.name}
                </span>
                <span className="block text-[11px] text-smoke">
                  {creator.clicks} {tApp("clicks").toLowerCase()} ·{" "}
                  {creator.tickets} {tApp("ticketsSold").toLowerCase()}
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-bold text-accent">
                {formatPriceXaf(creator.commissionXaf)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h4 className="mt-5 text-[12px] text-smoke">{t("inviteLabel")}</h4>
      <div className="mt-2 flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-full border border-dashed border-fog bg-paper px-4 py-3 text-[12px] text-brand">
          {inviteUrl}
        </code>
        <CopyButton
          value={inviteUrl}
          className="shrink-0 rounded-full border border-fog px-4 text-[12px] font-bold hover:border-brand hover:text-brand"
        />
      </div>
      <p className="mt-2 text-[12px] text-smoke">{t("inviteHint")}</p>

      {campaign.status !== "ended" && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-fog pt-4">
          <StatusButton
            campaignId={campaign.id}
            status={campaign.status === "active" ? "paused" : "active"}
            label={campaign.status === "active" ? t("pause") : t("resume")}
          />
          <StatusButton campaignId={campaign.id} status="ended" label={t("end")} />
          <p className="w-full text-[12px] text-smoke">{t("endHint")}</p>
        </div>
      )}
    </article>
  );
}

function StatusButton({
  campaignId,
  status,
  label,
}: {
  campaignId: string;
  status: CampaignStatus;
  label: string;
}) {
  return (
    <form action={setCampaignStatus}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="rounded-full border border-fog px-4 py-2 text-[12px] font-bold hover:border-brand hover:text-brand"
      >
        {label}
      </button>
    </form>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[14px] bg-paper p-4">
      <div className="text-[11px] text-smoke">{label}</div>
      <div
        className={`font-display mt-1.5 text-[19px] font-extrabold ${accent ? "text-accent" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
