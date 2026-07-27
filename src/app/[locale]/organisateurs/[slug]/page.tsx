import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getOrganizerBySlug, listOrganizerEvents } from "@/lib/db/organizers";
import { toggleFollow } from "@/lib/db/follow-actions";
import { lowestPrice } from "@/lib/db/events";
import type { OrganizerEvent } from "@/lib/db/organizers";
import { formatEventDateShort, formatPriceXaf } from "@/lib/format";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const organizer = await getOrganizerBySlug(slug);
  if (!organizer) return {};

  return {
    title: `${organizer.name} — SPOT`,
    description:
      (locale === "fr" ? organizer.bio_fr : organizer.bio_en) ?? undefined,
  };
}

/** Une ligne d'événement, reprise des deux sections de la maquette. */
async function EventRow({
  event,
  dimmed,
}: {
  event: OrganizerEvent;
  dimmed?: boolean;
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("events");
  const from = lowestPrice(event);

  return (
    <li className={dimmed ? "opacity-60" : undefined}>
      <Link
        href={`/evenements/${event.slug}`}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card p-3.5 transition-colors hover:border-brand/50"
      >
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
          style={{ background: event.gradient ?? FALLBACK_GRADIENT }}
        >
          {event.glyph ?? "🎟"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">
            {event.title}
          </span>
          <span className="mt-0.5 block text-[12px] text-mist">
            {formatEventDateShort(event.starts_at, locale)} · {event.venue}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-bold text-brand">
          {Number.isFinite(from) ? formatPriceXaf(from) : t("freeEntry")}
        </span>
      </Link>
    </li>
  );
}

export default async function OrganizerPublicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("organizerPage");
  const tApp = await getTranslations("app");
  const tEvents = await getTranslations("events");

  const organizer = await getOrganizerBySlug(slug);

  if (!organizer) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="font-display text-2xl font-extrabold">{t("notFound")}</h1>
        <p className="mt-2 text-[14px] text-mist">{t("notFoundHint")}</p>
        <Link
          href="/decouvrir"
          className="mt-6 inline-block text-[13px] font-semibold text-brand hover:underline"
        >
          ← {tEvents("backToEvents")}
        </Link>
      </main>
    );
  }

  const { upcoming, past } = await listOrganizerEvents(organizer.id);
  const bio = activeLocale === "fr" ? organizer.bio_fr : organizer.bio_en;
  const eventCount = upcoming.length + past.length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <Link
        href="/decouvrir"
        className="text-[13px] font-semibold text-mist hover:text-white"
      >
        ← {tEvents("backToEvents")}
      </Link>

      <section className="mt-4 flex items-center gap-4 rounded-[22px] border border-white/10 bg-card p-5">
        <span
          aria-hidden
          className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-full text-3xl"
          style={{ background: organizer.gradient ?? FALLBACK_GRADIENT }}
        >
          {organizer.glyph ?? "🎪"}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-[22px] font-extrabold">
            {organizer.name}
            {organizer.verified && (
              <span aria-hidden className="ml-1.5 text-accent">
                ✓
              </span>
            )}
          </h1>
          <p className="mt-1 text-[13px] text-mist">
            {eventCount} {tApp("eventsWord")} · {organizer.followers_count}{" "}
            {tApp("followers")}
          </p>
        </div>

        <form action={toggleFollow}>
          <input type="hidden" name="organizerId" value={organizer.id} />
          <input
            type="hidden"
            name="following"
            value={organizer.following ? "1" : "0"}
          />
          <button
            type="submit"
            className={`rounded-full border px-4 py-2 text-[12px] font-bold transition-colors ${
              organizer.following
                ? "border-white/15 bg-white/5 text-mist"
                : "border-brand bg-brand text-ink hover:opacity-90"
            }`}
          >
            {organizer.following ? tApp("following") : tApp("follow")}
          </button>
        </form>
      </section>

      {bio && (
        <p className="mt-5 text-[14px] leading-relaxed text-mist">{bio}</p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-[15px] font-extrabold">
          {tApp("upcoming")}
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-white/10 bg-card p-6 text-center text-[14px] text-mist">
            {t("noUpcoming")}
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {upcoming.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-[15px] font-extrabold">
            {tApp("history")}
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {past.map((event) => (
              <EventRow key={event.id} event={event} dimmed />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
