import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { BackIcon, DateIcon, DoneIcon, PlaceIcon } from "@/components/icons";
import { ShareButton } from "@/components/share-button";
import { getEventBySlug } from "@/lib/db/events";
import { formatEventDate, formatPriceXaf, isEventOver } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { getSiteUrl } from "@/lib/site-url";
import { getUser } from "@/lib/auth/dal";
import { TicketPicker } from "./ticket-picker";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const locale = (await getLocale()) as Locale;
  return {
    title: `${event.title} — SPOT`,
    description:
      (locale === "fr" ? event.description_fr : event.description_en) ??
      `${event.city} · ${event.venue}`,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("events");
  const user = await getUser();
  const poster = posterUrl(event.poster_path);
  const gradient = event.gradient ?? FALLBACK_GRADIENT;
  // Une soirée passée reste consultable — on y revient pour la retrouver,
  // ou parce qu'un lien traîne dans une conversation — mais elle ne se
  // vend plus. La vérité reste côté serveur : `createOrder` refuse de
  // toute façon un événement qui n'est pas ouvert à la vente.
  const ended = isEventOver(event.starts_at);

  const description =
    activeLocale === "fr" ? event.description_fr : event.description_en;

  const ticketTypes = event.ticket_types.map((tt) => ({
    id: tt.id,
    name: activeLocale === "fr" ? tt.name_fr : tt.name_en,
    priceXaf: tt.price_xaf,
    priceLabel: formatPriceXaf(tt.price_xaf),
    remaining: tt.quantity_total - tt.quantity_sold,
  }));

  const shareUrl = `${getSiteUrl()}${
    activeLocale === "fr" ? "" : `/${activeLocale}`
  }/evenements/${event.slug}`;

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Le halo de l'événement, dilué dans le haut de l'écran. C'est ce
          qui donne à chaque fiche sa couleur propre, avant même l'affiche. */}
      <span
        aria-hidden
        className="halo inset-x-0 -top-16 h-[300px] opacity-40"
        style={{ "--halo": gradient } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-4">
        <Link
          href="/decouvrir"
          className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mist hover:text-white"
        >
          <BackIcon size={16} strokeWidth={2.2} aria-hidden />
          {t("backToEvents")}
        </Link>

        {/* L'affiche téléversée par l'organisateur, à défaut le dégradé. */}
        <div
          className="relative mx-auto mt-4 flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded-sheet text-6xl shadow-[0_28px_70px_-24px_rgb(0_0_0/0.9)]"
          style={{ background: gradient }}
          aria-hidden
        >
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 100vw, 448px"
              className="object-cover"
            />
          ) : (
            (event.glyph ?? "🎟")
          )}
        </div>

        {ended && (
          <p className="mt-6">
            <span className="font-display inline-block rounded-full bg-white/5 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-mist ring-1 ring-inset ring-white/12">
              {t("ended")}
            </span>
          </p>
        )}

        <h1
          className={`font-display text-[30px] font-extrabold uppercase leading-[1.05] sm:text-4xl ${
            ended ? "mt-3" : "mt-7"
          }`}
        >
          {event.title}
        </h1>

        {/* L'organisateur tient le rôle de l'artiste : c'est lui qu'on
            suit, et c'est à lui qu'on revient. */}
        <Link
          href={`/organisateurs/${event.organizers.slug}`}
          className="press mt-4 inline-flex items-center gap-2.5"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
            style={{
              background: event.organizers.gradient ?? FALLBACK_GRADIENT,
            }}
          >
            {event.organizers.glyph ?? "🎪"}
          </span>
          <span className="flex items-center gap-1 text-[14px] font-bold">
            {event.organizers.name}
            {event.organizers.verified && (
              <DoneIcon
                size={13}
                strokeWidth={3}
                className="text-accent"
                aria-hidden
              />
            )}
          </span>
        </Link>

        <dl className="mt-5 flex flex-col gap-2.5 text-[14px]">
          <div className="flex items-center gap-2.5">
            <dt className="text-brand-bright">
              <DateIcon size={17} strokeWidth={2.2} aria-hidden />
              <span className="sr-only">{t("aboutEvent")}</span>
            </dt>
            <dd>{formatEventDate(event.starts_at, activeLocale)}</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <dt className="text-brand-bright">
              <PlaceIcon size={17} strokeWidth={2.2} aria-hidden />
              <span className="sr-only">{t("lineup")}</span>
            </dt>
            <dd>
              {event.venue} · {event.city}
            </dd>
          </div>
        </dl>

        <ShareButton
          url={shareUrl}
          title={event.title}
          className="press mt-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2.5 text-[13px] font-bold text-fog ring-1 ring-white/12 hover:text-white"
        />

        {description && (
          <section className="mt-8">
            <h2 className="font-display text-[17px] font-extrabold">
              {t("aboutEvent")}
            </h2>
            <p className="mt-2.5 whitespace-pre-line text-[14px] leading-relaxed text-mist">
              {description}
            </p>
          </section>
        )}

        <section className="mt-8">
          {ended ? (
            <div className="sheen rounded-sheet bg-surface p-8 text-center">
              <p className="font-display text-[16px] font-extrabold">
                {t("ended")}
              </p>
              <p className="mt-2 text-[13px] text-mist">{t("endedHint")}</p>
              <Link
                href="/decouvrir"
                className="press grad-ember glow-brand font-display mt-6 inline-flex items-center gap-1.5 rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white"
              >
                <BackIcon size={15} strokeWidth={2.4} aria-hidden />
                {t("backToEvents")}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-[17px] font-extrabold">
                {t("chooseTicket")}
              </h2>
              <TicketPicker
                eventSlug={event.slug}
                ticketTypes={ticketTypes}
                isSignedIn={Boolean(user)}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
