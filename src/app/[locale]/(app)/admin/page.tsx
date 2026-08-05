import type { ReactNode } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { MobileMoneyIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth/dal";
import {
  ADMIN_TABS,
  getAdminCommissions,
  getAdminCreators,
  getAdminEvents,
  getAdminKpis,
  getAdminLoyalty,
  getAdminOrganizers,
  getAdminPayments,
  getAdminUsers,
  isAdminTab,
  type AdminTab,
} from "@/lib/db/admin";
import { passLevelFor } from "@/lib/db/pass";
import { formatEventDate, formatPriceXaf } from "@/lib/format";

/** Une ligne du tableau : quatre colonnes, la dernière en couleur. */
type Row = {
  key: string;
  a: ReactNode;
  b: ReactNode;
  c: ReactNode;
  d: ReactNode;
  tone: string;
};

type Table = {
  cols: [string, string, string, string];
  rows: Row[];
};

/**
 * Console d'administration — écran « Administration » de la maquette.
 *
 * LECTURE SEULE, sans exception : aucun bouton n'écrit, aucune Server
 * Action n'est importée. Suspendre un compte ou refuser un événement
 * relève d'une décision produit qui n'a pas été prise ; afficher un
 * bouton qui ne fait rien serait pire que de n'en pas mettre.
 *
 * Trois colonnes de la maquette n'ont pas d'équivalent en base et sont
 * remplacées par un fait réel plutôt que par du décor :
 *   · « Statut » d'un utilisateur → son rôle (aucune suspension n'existe)
 *   · « Plan » d'un organisateur  → vérifié ou non (aucune offre payante)
 *   · « Réseau » d'un creator     → nombre de campagnes rejointes
 */
export default async function AdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireAdmin();

  const { onglet } = await searchParams;
  const tab: AdminTab = isAdminTab(onglet) ? onglet : "users";

  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("admin");
  const tMoney = await getTranslations("money");

  const [kpis, table] = await Promise.all([
    getAdminKpis(),
    buildTable(tab, activeLocale),
  ]);

  const cards = [
    { key: "kpiUsers", value: kpis.users_count.toLocaleString("fr-FR") },
    { key: "kpiActiveEvents", value: kpis.active_events.toLocaleString("fr-FR") },
    { key: "kpiVolume", value: formatPriceXaf(kpis.processed_volume_xaf) },
    { key: "kpiCommissions", value: formatPriceXaf(kpis.commissions_month_xaf) },
  ] as const;

  return (
    <main className="theme-paper flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-[22px] font-extrabold uppercase">
            {t("title")}
          </h1>
          {/* La seule porte de sortie vers un écran qui écrit : les
              retraits attendent un geste humain, la console non. */}
          <Link
            href="/admin/retraits"
            className="press font-display inline-flex items-center gap-1.5 rounded-full border border-paper-line bg-paper-card px-4 py-2.5 text-[13px] font-extrabold hover:border-brand hover:text-brand"
          >
            <MobileMoneyIcon size={15} strokeWidth={2.2} aria-hidden />
            {tMoney("adminTitle")}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.key} className="sheet rounded-card p-4">
              <div className="text-[12px] text-smoke">{t(card.key)}</div>
              <div className="font-display mt-2 text-[22px] font-extrabold">
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Les onglets défilent latéralement plutôt que de passer à la
            ligne : sept pastilles empilées mangeraient l'écran avant le
            tableau, qui est ce qu'on vient lire. */}
        <nav
          aria-label={t("title")}
          className="-mx-5 mt-6 flex items-center gap-1.5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {ADMIN_TABS.map((key) => {
            const active = key === tab;
            return (
              <Link
                key={key}
                href={{ pathname: "/admin", query: { onglet: key } }}
                aria-current={active ? "page" : undefined}
                className={`press shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold ${
                  active
                    ? "grad-ember glow-brand text-white"
                    : "border border-paper-line bg-paper-card text-smoke hover:border-brand hover:text-brand"
                }`}
              >
                {t(TAB_LABEL[key])}
              </Link>
            );
          })}
        </nav>

        <div className="sheet mt-4 overflow-hidden rounded-card">
          <div className="grid grid-cols-[1.6fr_1.3fr_1fr_1fr] gap-2.5 border-b border-paper-line bg-paper/60 px-4 py-3 text-[11px] font-bold uppercase tracking-[1px] text-smoke">
            {table.cols.map((col, index) => (
              <span key={index}>{col}</span>
            ))}
          </div>

          {table.rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-smoke">
              {t("empty")}
            </p>
          ) : (
            table.rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[1.6fr_1.3fr_1fr_1fr] items-center gap-2.5 border-b border-paper-line px-4 py-3.5 text-[13px] last:border-b-0"
              >
                <span className="truncate font-bold">{row.a}</span>
                <span className="truncate text-smoke">{row.b}</span>
                <span>{row.c}</span>
                <span className={`text-[11px] font-bold ${row.tone}`}>
                  {row.d}
                </span>
              </div>
            ))
          )}
        </div>

        <p className="mt-3 text-[11px] text-smoke">
          {t("limitHint", { count: 50 })} · {t("readOnlyHint")}
        </p>
      </div>
    </main>
  );
}

const TAB_LABEL: Record<AdminTab, string> = {
  users: "tabUsers",
  organizers: "tabOrganizers",
  events: "tabEvents",
  payments: "tabPayments",
  commissions: "tabCommissions",
  creators: "tabCreators",
  loyalty: "tabLoyalty",
};

/** Vert pour ce qui est abouti, rouge pour ce qui a échoué, orange pour ce qui attend. */
const ORDER_TONE = {
  paid: "text-success",
  pending: "text-warning",
  failed: "text-danger",
  expired: "text-smoke",
  refunded: "text-accent",
} as const;

const EVENT_TONE = {
  published: "text-success",
  draft: "text-warning",
  cancelled: "text-danger",
  ended: "text-smoke",
} as const;

const EVENT_STATUS_KEY = {
  published: "statusPublished",
  draft: "statusDraft",
  cancelled: "statusCancelled",
  ended: "statusEnded",
} as const;

async function buildTable(tab: AdminTab, locale: Locale): Promise<Table> {
  const t = await getTranslations("admin");
  const tApp = await getTranslations("app");
  const tOrg = await getTranslations("organizer");
  const tCheckout = await getTranslations("checkout");
  const tPass = await getTranslations("pass");

  /** Un compte sans nom saisi reste identifiable par son rôle et ses chiffres. */
  const named = (name: string | null) => name ?? t("unnamed");

  switch (tab) {
    case "users": {
      const rows = await getAdminUsers();
      return {
        cols: [tApp("name"), tApp("phoneCol"), tApp("tickets"), t("colRole")],
        rows: rows.map((row) => ({
          key: row.user_id,
          a: named(row.full_name),
          b: row.phone ?? "—",
          c: row.tickets,
          d: t(`role_${row.role}`),
          tone: row.role === "admin" ? "text-accent" : "text-smoke",
        })),
      };
    }

    case "organizers": {
      const rows = await getAdminOrganizers();
      return {
        cols: [
          t("colOrganizer"),
          tApp("eventsWord"),
          tApp("followers"),
          t("colVerified"),
        ],
        rows: rows.map((row) => ({
          key: row.organizer_id,
          a: (
            <>
              <span aria-hidden>{row.glyph ?? "🎪"}</span> {row.name}
            </>
          ),
          b: row.events_count,
          c: row.followers_count.toLocaleString("fr-FR"),
          d: row.verified ? t("verifiedYes") : t("verifiedNo"),
          tone: row.verified ? "text-success" : "text-smoke",
        })),
      };
    }

    case "events": {
      const rows = await getAdminEvents();
      return {
        cols: [tApp("event"), t("colDate"), tApp("sold"), tApp("status")],
        rows: rows.map((row) => ({
          key: row.event_id,
          a: (
            <>
              <span aria-hidden>{row.glyph ?? "🎟"}</span> {row.title}
            </>
          ),
          b: formatEventDate(row.starts_at, locale),
          c: `${row.sold} / ${row.capacity}`,
          d: tOrg(EVENT_STATUS_KEY[row.status]),
          tone: EVENT_TONE[row.status],
        })),
      };
    }

    case "payments": {
      const rows = await getAdminPayments();
      return {
        cols: [
          t("colTransaction"),
          t("colMethod"),
          t("colAmount"),
          tApp("status"),
        ],
        rows: rows.map((row) => ({
          key: row.order_id,
          a: `${row.reference} · ${row.event_title}`,
          b:
            row.channel === "mtn_momo"
              ? tCheckout("mtn")
              : row.channel === "orange_money"
                ? tCheckout("orange")
                : "—",
          c: formatPriceXaf(row.total_xaf),
          d: t(`order_${row.status}`),
          tone: ORDER_TONE[row.status],
        })),
      };
    }

    case "commissions": {
      const rows = await getAdminCommissions();
      return {
        cols: [t("colSource"), t("colType"), t("colRate"), t("colAmount")],
        rows: rows.map((row) => ({
          key: row.commission_id,
          a: named(row.creator_name),
          b: row.campaign_name,
          c:
            row.commission_kind === "percent"
              ? `${row.commission_value} %`
              : formatPriceXaf(row.commission_value),
          d: formatPriceXaf(row.amount_xaf),
          tone: "text-brand",
        })),
      };
    }

    case "creators": {
      const rows = await getAdminCreators();
      return {
        cols: [
          t("colCreator"),
          t("colCampaigns"),
          tApp("ticketsSold"),
          t("colCommission"),
        ],
        rows: rows.map((row) => ({
          key: row.creator_id,
          a: named(row.full_name),
          b: row.campaigns,
          c: row.tickets_sold,
          d: formatPriceXaf(row.commission_xaf),
          tone: "text-accent",
        })),
      };
    }

    case "loyalty": {
      const rows = await getAdminLoyalty();
      return {
        cols: [t("colUser"), t("colPoints"), t("colLevel"), t("colLastEarn")],
        rows: rows.map((row) => ({
          key: row.user_id,
          a: named(row.full_name),
          b: row.points.toLocaleString("fr-FR"),
          c: tPass(`levels.${passLevelFor(row.points)}`),
          // Un ajustement manuel n'est rattaché à aucun événement : on
          // montre alors les points seuls plutôt qu'un titre inventé.
          d:
            row.last_points === null
              ? "—"
              : `${row.last_points > 0 ? "+" : ""}${row.last_points}${
                  row.last_event_title ? ` · ${row.last_event_title}` : ""
                }`,
          tone: "text-success",
        })),
      };
    }
  }
}
