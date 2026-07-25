import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
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

  const view = {
    pending: {
      emoji: "⏳",
      title: t("statusPending"),
      hint: t("statusPendingHint"),
      tone: "border-warning/40 bg-warning/10 text-warning",
    },
    paid: {
      emoji: "✅",
      title: t("statusPaid"),
      hint: t("statusPaidHint"),
      tone: "border-success/40 bg-success/10 text-success",
    },
    failed: {
      emoji: "❌",
      title: t("statusFailed"),
      hint: t("statusFailedHint"),
      tone: "border-danger/40 bg-danger/10 text-danger",
    },
  }[order.status === "paid" ? "paid" : order.status === "pending" ? "pending" : "failed"];

  const isDev =
    process.env.NODE_ENV !== "production" &&
    (process.env.PAYMENT_PROVIDER ?? "mock") === "mock";

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
      {/* Une commande en attente se met à jour toute seule : c'est le
          webhook, pas l'utilisateur, qui fait avancer le statut. */}
      {order.status === "pending" && <AutoRefresh intervalMs={4000} />}

      <div className="text-center">
        <div className="text-6xl" aria-hidden>
          {view.emoji}
        </div>
        <h1 className="font-display mt-4 text-2xl font-extrabold uppercase tracking-tight">
          {view.title}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-mist">{view.hint}</p>
      </div>

      <dl className={`mt-8 rounded-2xl border px-4 py-3 text-[13px] ${view.tone}`}>
        <div className="flex justify-between">
          <dt>{t("orderRef")}</dt>
          <dd className="font-mono font-semibold">{order.reference}</dd>
        </div>
        <div className="mt-1 flex justify-between">
          <dt>{t("total")}</dt>
          <dd className="font-semibold">{formatPriceXaf(order.total_xaf)}</dd>
        </div>
      </dl>

      {order.status === "paid" && (
        <Link
          href="/billets"
          className="mt-6 block rounded-2xl bg-brand px-4 py-3.5 text-center font-display text-[15px] font-extrabold text-white hover:opacity-90"
        >
          {t("seeTickets")}
        </Link>
      )}

      {order.status === "failed" && (
        <Link
          href="/decouvrir"
          className="mt-6 block rounded-2xl border border-white/15 px-4 py-3.5 text-center font-display text-[15px] font-extrabold hover:border-brand/50"
        >
          {t("retry")}
        </Link>
      )}

      {isDev && order.status === "pending" && (
        <section className="mt-10 rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-4">
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
                className="w-full rounded-xl bg-success px-3 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
              >
                {t("devSimulatePaid")}
              </button>
            </form>
            <form action={simulatePaymentWebhook} className="flex-1">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="status" value="failed" />
              <button
                type="submit"
                className="w-full rounded-xl border border-danger/50 px-3 py-2.5 text-[13px] font-semibold text-danger hover:bg-danger/10"
              >
                {t("devSimulateFailed")}
              </button>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}
