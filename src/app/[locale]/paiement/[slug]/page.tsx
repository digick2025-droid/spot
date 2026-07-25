import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { getEventBySlug } from "@/lib/db/events";
import { requireProfile } from "@/lib/auth/dal";
import { formatEventDate, formatPriceXaf } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ billet?: string; quantite?: string }>;
}) {
  const { locale, slug } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  // Redirige vers la connexion si nécessaire.
  const profile = await requireProfile();

  const { billet, quantite } = await searchParams;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const ticketType =
    event.ticket_types.find((tt) => tt.id === billet) ?? event.ticket_types[0];
  if (!ticketType) notFound();

  const quantity = Math.min(
    Math.max(Number(quantite) || 1, 1),
    Math.min(6, ticketType.quantity_total - ticketType.quantity_sold)
  );

  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("checkout");
  const total = ticketType.price_xaf * quantity;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
        {t("title")}
      </h1>

      <section className="mt-6 rounded-[20px] border border-white/10 bg-card p-5">
        <h2 className="font-display text-[13px] font-extrabold uppercase tracking-wide text-smoke">
          {t("summary")}
        </h2>

        <p className="font-display mt-3 text-[17px] font-extrabold">
          {event.title}
        </p>
        <p className="mt-1 text-[13px] text-mist">
          {formatEventDate(event.starts_at, activeLocale)}
        </p>
        <p className="text-[13px] text-mist">
          {event.venue} · {event.city}
        </p>

        <dl className="mt-4 flex flex-col gap-1.5 border-t border-white/10 pt-4 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-mist">{t("ticket")}</dt>
            <dd>{activeLocale === "fr" ? ticketType.name_fr : ticketType.name_en}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-mist">{t("quantity")}</dt>
            <dd>{quantity}</dd>
          </div>
          <div className="mt-1 flex justify-between border-t border-white/10 pt-3">
            <dt className="font-semibold">{t("total")}</dt>
            <dd className="font-display text-xl font-extrabold text-brand">
              {formatPriceXaf(total)}
            </dd>
          </div>
        </dl>
      </section>

      <CheckoutForm
        eventSlug={event.slug}
        ticketTypeId={ticketType.id}
        quantity={quantity}
        totalLabel={formatPriceXaf(total)}
        defaultPhone={profile.phone ?? ""}
      />
    </main>
  );
}
