import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { BackIcon, DoneIcon, FollowIcon } from "@/components/icons";
import { getOrganizerBySlug, listOrganizerEvents } from "@/lib/db/organizers";
import { toggleFollow } from "@/lib/db/follow-actions";
import { lowestPrice } from "@/lib/db/events";
import type { OrganizerEvent } from "@/lib/db/organizers";
import { formatEventDateShort, formatPriceXaf } from "@/lib/format";
import { posterUrl } from "@/lib/posters";

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

/** Une ligne d'événement : la pochette, la date, le prix. */
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
  const poster = posterUrl(event.poster_path);

  return (
    <li className={dimmed ? "opacity-55" : undefined}>
      <Link
        href={`/evenements/${event.slug}`}
        className="press sheen flex items-center gap-3.5 rounded-card bg-surface p-3 transition-colors hover:bg-surface-high"
      >
        <span
          aria-hidden
          className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl"
          style={{ background: event.gradient ?? FALLBACK_GRADIENT }}
        >
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            (event.glyph ?? "🎟")
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block truncate text-[14px] font-extrabold">
            {event.title}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-mist">
            {formatEventDateShort(event.starts_at, locale)} · {event.venue}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-bold">
          {Number.isFinite(from) ? formatPriceXaf(from) : t("freeEntry")}
        </span>
      </Link>
    </li>
  );
}

/**
 * La page d'un organisateur — sa page d'artiste.
 *
 * Elle est bâtie comme celle d'un musicien : la pastille en grand, le
 * nom, ce qu'on peut en savoir, puis la discographie — les soirées à
 * venir, et derrière elles l'historique, qui dit ce que vaut la maison.
 */
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10 pt-8">
        <h1 className="font-display text-2xl font-extrabold">{t("notFound")}</h1>
        <p className="mt-2 text-[14px] text-mist">{t("notFoundHint")}</p>
        <Link
          href="/decouvrir"
          className="press mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-bright"
        >
          <BackIcon size={16} strokeWidth={2.2} aria-hidden />
          {tEvents("backToEvents")}
        </Link>
      </main>
    );
  }

  const { upcoming, past } = await listOrganizerEvents(organizer.id);
  const bio = activeLocale === "fr" ? organizer.bio_fr : organizer.bio_en;
  const eventCount = upcoming.length + past.length;
  const gradient = organizer.gradient ?? FALLBACK_GRADIENT;

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* La couleur de la maison, diffusée derrière son nom. */}
      <span
        aria-hidden
        className="halo inset-x-0 -top-24 h-[300px] opacity-40"
        style={{ "--halo": gradient } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-4">
        <Link
          href="/decouvrir"
          className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mist hover:text-white"
        >
          <BackIcon size={16} strokeWidth={2.2} aria-hidden />
          {tEvents("backToEvents")}
        </Link>

        <section className="mt-6 flex flex-col items-center text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
          <span
            aria-hidden
            className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-full text-4xl shadow-[0_18px_44px_-16px_rgb(0_0_0/0.9)] ring-1 ring-white/12"
            style={{ background: gradient }}
          >
            {organizer.glyph ?? "🎪"}
          </span>

          <div className="mt-4 min-w-0 flex-1 sm:mt-0">
            <h1 className="font-display flex items-center justify-center gap-1.5 text-[26px] font-extrabold leading-tight sm:justify-start">
              <span className="truncate">{organizer.name}</span>
              {organizer.verified && (
                <DoneIcon
                  size={16}
                  strokeWidth={3}
                  className="shrink-0 text-accent"
                  aria-hidden
                />
              )}
            </h1>
            <p className="mt-1.5 text-[13px] text-mist">
              {eventCount} {tApp("eventsWord")} · {organizer.followers_count}{" "}
              {tApp("followers")}
            </p>

            <form action={toggleFollow} className="mt-4">
              <input type="hidden" name="organizerId" value={organizer.id} />
              <input
                type="hidden"
                name="following"
                value={organizer.following ? "1" : "0"}
              />
              {/* Suivre est l'action de la page : elle porte la braise.
                  Une fois abonné, le bouton se retire au second plan — il
                  ne sert plus qu'à se désabonner. */}
              <button
                type="submit"
                className={`press font-display inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-extrabold transition-colors ${
                  organizer.following
                    ? "bg-white/5 text-mist ring-1 ring-inset ring-white/12 hover:text-white"
                    : "grad-ember glow-brand text-white"
                }`}
              >
                <FollowIcon
                  size={15}
                  strokeWidth={2.4}
                  fill={organizer.following ? "currentColor" : "none"}
                  aria-hidden
                />
                {organizer.following ? tApp("following") : tApp("follow")}
              </button>
            </form>
          </div>
        </section>

        {bio && (
          <p className="mt-6 text-[14px] leading-relaxed text-mist">{bio}</p>
        )}

        <section className="mt-8">
          <h2 className="font-display text-[17px] font-extrabold">
            {tApp("upcoming")}
          </h2>
          {upcoming.length === 0 ? (
            <p className="sheen mt-4 rounded-card bg-surface p-6 text-center text-[14px] text-mist">
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
            <h2 className="font-display text-[17px] font-extrabold">
              {tApp("history")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {past.map((event) => (
                <EventRow key={event.id} event={event} dimmed />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
