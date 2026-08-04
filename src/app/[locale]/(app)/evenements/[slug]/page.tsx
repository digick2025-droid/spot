import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getEventBySlug } from "@/lib/db/events";
import { formatEventDate, formatPriceXaf } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
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

  const description =
    activeLocale === "fr" ? event.description_fr : event.description_en;

  const ticketTypes = event.ticket_types.map((tt) => ({
    id: tt.id,
    name: activeLocale === "fr" ? tt.name_fr : tt.name_en,
    priceXaf: tt.price_xaf,
    priceLabel: formatPriceXaf(tt.price_xaf),
    remaining: tt.quantity_total - tt.quantity_sold,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <Link
        href="/decouvrir"
        className="text-[13px] font-semibold text-mist hover:text-white"
      >
        ← {t("backToEvents")}
      </Link>

      {/* L'affiche téléversée par l'organisateur, à défaut le dégradé. */}
      <div
        className="relative mt-4 flex h-40 items-center justify-center overflow-hidden rounded-[20px] text-6xl sm:h-56"
        style={{ background: event.gradient ?? FALLBACK_GRADIENT }}
        aria-hidden
      >
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        ) : (
          (event.glyph ?? "🎟")
        )}
      </div>

      <h1 className="font-display mt-6 text-3xl font-extrabold uppercase leading-tight tracking-tight">
        {event.title}
      </h1>

      <dl className="mt-4 flex flex-col gap-2 text-[14px]">
        <div className="flex gap-2">
          <dt aria-hidden>📅</dt>
          <dd>{formatEventDate(event.starts_at, activeLocale)}</dd>
        </div>
        <div className="flex gap-2">
          <dt aria-hidden>📍</dt>
          <dd>
            {event.venue} · {event.city}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt aria-hidden>🎤</dt>
          <dd>
            <Link
              href={`/organisateurs/${event.organizers.slug}`}
              className="text-mist underline-offset-4 hover:text-white hover:underline"
            >
              {event.organizers.name}
            </Link>
          </dd>
        </div>
      </dl>

      {description && (
        <section className="mt-8">
          <h2 className="font-display text-[15px] font-extrabold">
            {t("aboutEvent")}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-mist">
            {description}
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-[15px] font-extrabold">
          {t("chooseTicket")}
        </h2>
        <TicketPicker
          eventSlug={event.slug}
          ticketTypes={ticketTypes}
          isSignedIn={Boolean(user)}
        />
      </section>
    </main>
  );
}
