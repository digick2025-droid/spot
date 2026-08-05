import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import {
  AddIcon,
  CampaignIcon,
  DateIcon,
  FollowIcon,
  OrganizerIcon,
  RevenueIcon,
  TicketIcon,
} from "@/components/icons";
import { requireProfile } from "@/lib/auth/dal";
import { getOrganizerDashboard, type MyEvent } from "@/lib/db/organizer";
import { formatEventDate, formatPriceXaf } from "@/lib/format";
import { OrganizerSetup } from "./organizer-setup";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/** Couleurs de pastille reprises de la maquette (thème clair). */
const STATUS_STYLE: Record<MyEvent["status"], string> = {
  published: "text-success",
  draft: "text-warning",
  cancelled: "text-danger",
  ended: "text-smoke",
};

const STATUS_KEY: Record<MyEvent["status"], string> = {
  published: "statusPublished",
  draft: "statusDraft",
  cancelled: "statusCancelled",
  ended: "statusEnded",
};

/**
 * Tableau de bord organisateur — écran clair de la maquette.
 *
 * L'accès n'est pas une autorisation : la page se contente d'afficher ce
 * que la RLS laisse lire. Sans fiche organisateur, elle propose de la
 * créer plutôt que de refuser.
 */
export default async function OrganizerDashboardPage({
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
  const t = await getTranslations("organizer");
  const tApp = await getTranslations("app");

  const dashboard = await getOrganizerDashboard();

  if (!dashboard) {
    return (
      <main className="theme-paper flex-1 bg-paper text-ink">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <h1 className="font-display text-2xl font-extrabold">
            {t("setupTitle")}
          </h1>
          <p className="mt-2 text-[14px] text-smoke">{t("setupHint")}</p>
          <OrganizerSetup defaultName={profile.full_name ?? ""} />
        </div>
      </main>
    );
  }

  const { organizer, events } = dashboard;

  const kpis = [
    { key: "kpiEvents", Icon: OrganizerIcon, value: `${dashboard.published}` },
    { key: "kpiSold", Icon: TicketIcon, value: `${dashboard.sold}` },
    {
      key: "kpiRevenue",
      Icon: RevenueIcon,
      value: formatPriceXaf(dashboard.revenue_xaf),
    },
    {
      key: "kpiFollowers",
      Icon: FollowIcon,
      value: `${organizer.followers_count}`,
    },
  ] as const;

  return (
    <main className="theme-paper flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-4xl px-5 pb-10 pt-6 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl shadow-[0_8px_20px_-10px_rgb(16_16_24/0.5)]"
            style={{ background: organizer.gradient ?? FALLBACK_GRADIENT }}
          >
            {organizer.glyph ?? "🎪"}
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate text-[22px] font-extrabold">
              {tApp("hello")} {organizer.name}
            </h1>
            <p className="text-[12px] text-smoke">{tApp("orgSpace")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.key} className="sheet rounded-card p-4">
              <div className="flex items-center gap-1.5 text-[12px] text-smoke">
                <kpi.Icon size={14} strokeWidth={2.2} aria-hidden />
                {t(kpi.key)}
              </div>
              <div className="font-display mt-2 text-[22px] font-extrabold">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[17px] font-extrabold">
            {tApp("myEvents")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/organisateur/campagnes"
              className="press font-display inline-flex items-center gap-1.5 rounded-full border border-paper-line bg-paper-card px-4 py-2.5 text-[13px] font-extrabold hover:border-brand hover:text-brand"
            >
              <CampaignIcon size={15} strokeWidth={2.2} aria-hidden />
              {tApp("campaigns")}
            </Link>
            {/* Créer un événement est l'action de la page : elle porte la
                braise, ici comme dans l'espace sombre. */}
            <Link
              href="/organisateur/evenements/nouveau"
              className="press grad-ember glow-brand font-display inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-extrabold text-white"
            >
              <AddIcon size={15} strokeWidth={2.6} aria-hidden />
              {tApp("createEvent")}
            </Link>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="sheet mt-4 rounded-card p-8 text-center">
            <p className="text-[15px] font-semibold">{t("noEvents")}</p>
            <p className="mt-2 text-[13px] text-smoke">{t("noEventsHint")}</p>
          </div>
        ) : (
          <ul className="sheet mt-4 overflow-hidden rounded-card">
            {events.map((event) => (
              <li
                key={event.id}
                className="border-b border-paper-line last:border-b-0"
              >
                <Link
                  href={`/organisateur/evenements/${event.id}`}
                  title={t("editLink")}
                  className="grid grid-cols-2 items-center gap-3 p-4 transition hover:bg-paper sm:grid-cols-[2.2fr_1fr_1.4fr_1fr_0.9fr] sm:gap-4"
                >
                  <span className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[15px]"
                      style={{ background: event.gradient ?? FALLBACK_GRADIENT }}
                    >
                      {event.glyph ?? "🎟"}
                    </span>
                    <span className="truncate text-[13px] font-bold">
                      {event.title}
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5 text-[12px] text-smoke">
                    <DateIcon
                      size={13}
                      strokeWidth={2.2}
                      className="shrink-0"
                      aria-hidden
                    />
                    <span className="truncate">
                      {formatEventDate(event.starts_at, activeLocale)}
                    </span>
                  </span>

                  <div>
                    <div className="text-[12px]">
                      {t("soldOf", {
                        sold: event.sold,
                        capacity: event.capacity,
                      })}
                    </div>
                    {/* La jauge dit en un coup d'œil ce que la ligne de
                        chiffres demande de calculer. */}
                    <div
                      aria-hidden
                      className="mt-1 h-[5px] overflow-hidden rounded-full bg-paper-line"
                    >
                      <div
                        className="grad-ember h-full rounded-full"
                        style={{
                          width: `${
                            event.capacity > 0
                              ? Math.round((event.sold / event.capacity) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <span className="text-[13px] font-bold">
                    {formatPriceXaf(event.revenue_xaf)}
                  </span>

                  <span
                    className={`text-[11px] font-bold ${STATUS_STYLE[event.status]}`}
                  >
                    {t(STATUS_KEY[event.status])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
