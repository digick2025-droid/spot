import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { getEventBySlug } from "@/lib/db/events";
import { requireProfile } from "@/lib/auth/dal";
import { formatEventDate, formatPriceXaf } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { CheckoutForm } from "./checkout-form";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ billet?: string; quantite?: string; cadeau?: string }>;
}) {
  const { locale, slug } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  // Redirige vers la connexion si nécessaire.
  const profile = await requireProfile();

  // Le drapeau du cadeau seulement : à qui l'on offre se saisit dans le
  // formulaire, jamais dans l'adresse.
  const { billet, quantite, cadeau } = await searchParams;
  const isGift = cadeau === "1";
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
  const gradient = event.gradient ?? FALLBACK_GRADIENT;
  const poster = posterUrl(event.poster_path);

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* On paie une soirée, pas une ligne de commande : son halo et son
          affiche restent présents jusqu'à la dernière étape. */}
      <span
        aria-hidden
        className="halo inset-x-0 -top-20 h-[260px] opacity-35"
        style={{ "--halo": gradient } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-lg px-5 pb-10 pt-6">
        <h1 className="font-display text-[30px] font-extrabold uppercase">
          {t("title")}
        </h1>

        <section className="sheen mt-6 rounded-sheet bg-surface p-5">
          <h2 className="font-display text-[13px] font-extrabold uppercase tracking-wide text-smoke">
            {t("summary")}
          </h2>

          <div className="mt-3.5 flex items-center gap-3.5">
            <span
              aria-hidden
              className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl"
              style={{ background: gradient }}
            >
              {poster ? (
                <Image
                  src={poster}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                (event.glyph ?? "🎟")
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-display line-clamp-2 text-[16px] font-extrabold leading-tight">
                {event.title}
              </p>
              <p className="mt-1 text-[12px] text-mist">
                {formatEventDate(event.starts_at, activeLocale)}
              </p>
              <p className="truncate text-[12px] text-smoke">
                {event.venue} · {event.city}
              </p>
            </div>
          </div>

          <dl className="mt-4 flex flex-col gap-1.5 border-t border-white/10 pt-4 text-[14px]">
            <div className="flex justify-between gap-3">
              <dt className="text-mist">{t("ticket")}</dt>
              <dd className="truncate">
                {activeLocale === "fr" ? ticketType.name_fr : ticketType.name_en}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-mist">{t("quantity")}</dt>
              <dd>{quantity}</dd>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <dt className="font-semibold">{t("total")}</dt>
              {/* Le montant est ce qu'on relit trois fois avant de payer :
                  il porte la braise, seul élément coloré de la feuille. */}
              <dd className="text-ember font-display text-xl font-extrabold">
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
          isGift={isGift}
        />
      </div>
    </main>
  );
}
