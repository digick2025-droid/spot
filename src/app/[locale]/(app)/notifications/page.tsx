import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import {
  getMyNotifications,
  type Notification,
  type NotificationType,
} from "@/lib/db/notifications";
import { markAllNotificationsRead } from "@/lib/db/notification-actions";
import { payoutFailureLabel } from "@/lib/db/payout-state";
import { formatEventDate, formatPriceXaf } from "@/lib/format";

const ICON: Record<NotificationType, string> = {
  points_earned: "⭐",
  payout_paid: "💸",
  payout_failed: "⚠️",
  creator_joined: "📣",
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
          {t("title")}
        </h1>
        {hasUnread && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-[12px] font-bold text-mist hover:border-brand hover:text-brand"
            >
              {t("markAllRead")}
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-8 rounded-[20px] border border-white/10 bg-card p-8 text-center">
          <div className="text-4xl" aria-hidden>
            🔔
          </div>
          <p className="mt-4 text-[15px] font-semibold">{t("empty")}</p>
          <p className="mt-2 text-[13px] text-mist">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <NotificationRow notification={notification} locale={activeLocale} />
            </li>
          ))}
        </ul>
      )}
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

  return (
    <div
      className={`flex items-start gap-4 rounded-[20px] border p-4 ${
        unread ? "border-brand/40 bg-card" : "border-white/10 bg-card/60"
      }`}
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-xl"
      >
        {ICON[notification.type]}
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
