import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
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
      <main className="flex-1 bg-paper text-ink">
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
    { key: "kpiEvents", emoji: "🎪", value: `${dashboard.published}` },
    { key: "kpiSold", emoji: "🎟", value: `${dashboard.sold}` },
    { key: "kpiRevenue", emoji: "💰", value: formatPriceXaf(dashboard.revenue_xaf) },
    { key: "kpiFollowers", emoji: "❤️", value: `${organizer.followers_count}` },
  ] as const;

  return (
    <main className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
            style={{ background: organizer.gradient ?? FALLBACK_GRADIENT }}
          >
            {organizer.glyph ?? "🎪"}
          </span>
          <div className="min-w-0">
            <h1 className="font-display truncate text-[22px] font-extrabold">
              {tApp("hello")} {organizer.name} 👋
            </h1>
            <p className="text-[12px] text-smoke">{tApp("orgSpace")}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.key}
              className="rounded-[18px] border border-fog bg-paper-card p-4"
            >
              <div className="text-[12px] text-smoke">
                <span aria-hidden>{kpi.emoji}</span> {t(kpi.key)}
              </div>
              <div className="font-display mt-2 text-[22px] font-extrabold">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[15px] font-extrabold">
            {tApp("myEvents")}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/organisateur/campagnes"
              className="rounded-full border border-fog px-4 py-2 font-display text-[13px] font-extrabold hover:border-brand hover:text-brand"
            >
              📣 {tApp("campaigns")}
            </Link>
            <Link
              href="/organisateur/evenements/nouveau"
              className="rounded-full bg-brand px-4 py-2 font-display text-[13px] font-extrabold text-white hover:opacity-90"
            >
              + {tApp("createEvent")}
            </Link>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-fog bg-paper-card p-8 text-center">
            <p className="text-[15px] font-semibold">{t("noEvents")}</p>
            <p className="mt-2 text-[13px] text-smoke">{t("noEventsHint")}</p>
          </div>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-[18px] border border-fog bg-paper-card">
            {events.map((event) => (
              <li
                key={event.id}
                className="grid grid-cols-2 items-center gap-3 border-b border-fog/70 p-4 last:border-b-0 sm:grid-cols-[2.2fr_1fr_1.4fr_1fr_0.9fr] sm:gap-4"
              >
                <span className="col-span-2 truncate text-[13px] font-bold sm:col-span-1">
                  <span aria-hidden>{event.glyph ?? "🎟"}</span> {event.title}
                </span>

                <span className="text-[12px] text-smoke">
                  {formatEventDate(event.starts_at, activeLocale)}
                </span>

                <div>
                  <div className="text-[12px]">
                    {t("soldOf", { sold: event.sold, capacity: event.capacity })}
                  </div>
                  <div
                    aria-hidden
                    className="mt-1 h-[5px] overflow-hidden rounded-full bg-fog"
                  >
                    <div
                      className="h-full rounded-full bg-brand"
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
