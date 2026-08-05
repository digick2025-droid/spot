import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { AlertIcon, DoneIcon, PendingIcon } from "@/components/icons";
import { Sticker, type StickerTone } from "@/components/sticker";
import { requireProfile } from "@/lib/auth/dal";
import { getOrderForUser } from "@/lib/db/orders";
import { formatPriceXaf } from "@/lib/format";
import { simulatePaymentWebhook } from "@/lib/payments/dev-actions";
import { AutoRefresh } from "./auto-refresh";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const profile = await requireProfile();
  const order = await getOrderForUser(id, profile.id);
  if (!order) notFound();

  const t = await getTranslations("checkout");

  /**
   * L'attente est le cas le plus fréquent — on vient de composer son code
   * Mobile Money et rien n'est encore confirmé. Elle a donc droit à la
   * même mise en scène que la réussite : une icône lisible, un halo, et
   * une page qui se met à jour toute seule plutôt qu'un bouton à presser.
   */
  const view = {
    pending: {
      icon: <PendingIcon size={30} strokeWidth={2.2} />,
      tone: "night" as StickerTone,
      halo: "var(--grad-night)",
      title: t("statusPending"),
      hint: t("statusPendingHint"),
      chip: "text-warning",
    },
    paid: {
      icon: <DoneIcon size={32} strokeWidth={3} />,
      tone: "heat" as StickerTone,
      halo: "var(--grad-heat)",
      title: t("statusPaid"),
      hint: t("statusPaidHint"),
      chip: "text-success",
    },
    failed: {
      // Un sticker gris à icône rouge : le rouge sert d'alerte, il ne
      // devient pas une pastille décorative de plus.
      icon: <AlertIcon size={28} strokeWidth={2.2} className="text-danger" />,
      tone: "mist" as StickerTone,
      halo: "linear-gradient(135deg,#EF4444,#7F1D1D)",
      title: t("statusFailed"),
      hint: t("statusFailedHint"),
      chip: "text-danger",
    },
  }[
    order.status === "paid"
      ? "paid"
      : order.status === "pending"
        ? "pending"
        : "failed"
  ];

  const isDev =
    process.env.NODE_ENV !== "production" &&
    (process.env.PAYMENT_PROVIDER ?? "mock") === "mock";

  return (
    <main className="relative flex-1 overflow-hidden">
      <span
        aria-hidden
        className="halo inset-x-0 -top-24 h-[280px] opacity-35"
        style={{ "--halo": view.halo } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-lg px-6 pb-12 pt-12">
        {/* Une commande en attente se met à jour toute seule : c'est le
            webhook, pas l'utilisateur, qui fait avancer le statut. */}
        {order.status === "pending" && <AutoRefresh intervalMs={4000} />}

        <div className="text-center">
          <Sticker tone={view.tone} size="lg" className="mx-auto">
            {view.icon}
          </Sticker>
          <h1 className="font-display mt-5 text-2xl font-extrabold uppercase tracking-tight">
            {view.title}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-mist">
            {view.hint}
          </p>
        </div>

        <dl className="sheen mt-8 rounded-card bg-surface px-4 py-3.5 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-mist">{t("orderRef")}</dt>
            <dd className="truncate font-mono font-semibold">
              {order.reference}
            </dd>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <dt className="text-mist">{t("total")}</dt>
            <dd className={`font-display font-extrabold ${view.chip}`}>
              {formatPriceXaf(order.total_xaf)}
            </dd>
          </div>
        </dl>

        {order.status === "paid" && (
          <Link
            href="/billets"
            className="press grad-ember glow-brand font-display mt-6 block rounded-2xl px-4 py-3.5 text-center text-[15px] font-extrabold text-white"
          >
            {t("seeTickets")}
          </Link>
        )}

        {order.status === "failed" && (
          <Link
            href="/decouvrir"
            className="press font-display mt-6 block rounded-2xl bg-surface-high px-4 py-3.5 text-center text-[15px] font-extrabold ring-1 ring-inset ring-white/10 hover:ring-brand/50"
          >
            {t("retry")}
          </Link>
        )}

        {isDev && order.status === "pending" && (
          <section className="mt-10 rounded-card border border-dashed border-accent/50 bg-accent/5 p-4">
            <h2 className="font-display text-[13px] font-extrabold uppercase tracking-wide text-accent">
              {t("devSimulate")}
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-mist">
              {t("devNote")}
            </p>
            <div className="mt-3 flex gap-2">
              <form action={simulatePaymentWebhook} className="flex-1">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="status" value="paid" />
                <button
                  type="submit"
                  className="press w-full rounded-xl bg-success px-3 py-2.5 text-[13px] font-semibold text-white"
                >
                  {t("devSimulatePaid")}
                </button>
              </form>
              <form action={simulatePaymentWebhook} className="flex-1">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="status" value="failed" />
                <button
                  type="submit"
                  className="press w-full rounded-xl px-3 py-2.5 text-[13px] font-semibold text-danger ring-1 ring-inset ring-danger/50 hover:bg-danger/10"
                >
                  {t("devSimulateFailed")}
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
