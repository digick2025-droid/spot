import type { ComponentType } from "react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import {
  AlertIcon,
  CampaignIcon,
  NotificationIcon,
  PointsIcon,
  RevenueIcon,
} from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { requireProfile } from "@/lib/auth/dal";
import {
  getMyNotifications,
  type Notification,
  type NotificationType,
} from "@/lib/db/notifications";
import { markAllNotificationsRead } from "@/lib/db/notification-actions";
import { payoutFailureLabel } from "@/lib/db/payout-state";
import { formatEventDate, formatPriceXaf } from "@/lib/format";

/**
 * Chaque type de notification a son icône et sa teinte : dans une liste
 * lue de haut en bas, la couleur dit déjà s'il s'agit d'un gain, d'un
 * versement ou d'un incident, avant même la première ligne de texte.
 */
const LOOK: Record<
  NotificationType,
  { Icon: ComponentType<{ size?: number; strokeWidth?: number }>; tint: string }
> = {
  points_earned: { Icon: PointsIcon, tint: "bg-brand/15 text-brand-bright" },
  payout_paid: { Icon: RevenueIcon, tint: "bg-success/15 text-success" },
  payout_failed: { Icon: AlertIcon, tint: "bg-danger/15 text-danger" },
  creator_joined: { Icon: CampaignIcon, tint: "bg-accent/15 text-accent" },
};

export default async function NotificationsPage({
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
  const t = await getTranslations("notifications");
  const notifications = await getMyNotifications();
  const hasUnread = notifications.some((n) => n.readAt === null);

  return (
    <main className="relative flex-1 overflow-hidden">
      <span
        aria-hidden
        className="halo inset-x-0 -top-20 h-[240px] opacity-25"
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-[30px] font-extrabold uppercase">
            {t("title")}
          </h1>
          {hasUnread && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="press shrink-0 rounded-full px-4 py-2 text-[12px] font-bold text-mist ring-1 ring-inset ring-white/12 hover:text-white"
              >
                {t("markAllRead")}
              </button>
            </form>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="sheen mt-8 rounded-sheet bg-surface p-8 text-center">
            <Sticker tone="ember" size="lg" className="mx-auto">
              <NotificationIcon size={30} strokeWidth={2.2} />
            </Sticker>
            <p className="mt-5 text-[15px] font-semibold">{t("empty")}</p>
            <p className="mt-2 text-[13px] text-mist">{t("emptyHint")}</p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationRow
                  notification={notification}
                  locale={activeLocale}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

/** Une ligne dérive son texte du seul couple (type, payload) — figé à l'écriture. */
async function NotificationRow({
  notification,
  locale,
}: {
  notification: Notification;
  locale: Locale;
}) {
  const t = await getTranslations("notifications");
  const tAff = await getTranslations("affiliation");
  const p = notification.payload;
  const unread = notification.readAt === null;

  let title: string;
  let hint: string;

  switch (notification.type) {
    case "points_earned":
      title = t("pointsEarned", { points: Number(p.points ?? 0) });
      hint = t("pointsEarnedHint");
      break;
    case "payout_paid":
      title = t("payoutPaid", {
        amount: formatPriceXaf(Number(p.amount_xaf ?? 0)),
      });
      hint = t("payoutPaidHint", { reference: String(p.reference ?? "") });
      break;
    case "payout_failed": {
      title = t("payoutFailed", {
        amount: formatPriceXaf(Number(p.amount_xaf ?? 0)),
      });
      // Les notifications antérieures au codage portent la phrase de
      // l'agrégateur : elle reste affichée telle quelle, faute de mieux.
      hint = t("payoutFailedHint", {
        note: payoutFailureLabel(String(p.note ?? ""), tAff),
      });
      break;
    }
    case "creator_joined":
      title = t("creatorJoined", {
        creator: String(p.creator_name ?? "—"),
        campaign: String(p.campaign_name ?? ""),
      });
      hint = t("creatorJoinedHint", { event: String(p.event_title ?? "") });
      break;
  }

  const { Icon, tint } = LOOK[notification.type];

  return (
    <div
      className={`sheen flex items-start gap-4 rounded-card p-4 ${
        unread
          ? "bg-surface-high ring-1 ring-inset ring-brand/40"
          : "bg-surface opacity-80"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tint}`}
      >
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display block truncate text-[14px] font-extrabold">
            {title}
          </span>
          {unread && (
            <span
              aria-label={t("unread")}
              className="h-2 w-2 shrink-0 rounded-full bg-brand"
            />
          )}
        </span>
        <span className="mt-0.5 block text-[12px] text-mist">{hint}</span>
        <span className="mt-1 block text-[11px] text-smoke">
          {formatEventDate(notification.createdAt, locale)}
        </span>
      </span>
    </div>
  );
}
