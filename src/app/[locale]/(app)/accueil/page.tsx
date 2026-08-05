import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { EventCard } from "@/components/event-card";
import { DoneIcon, HotIcon, NextIcon, SearchIcon } from "@/components/icons";
import { OrganizerCta } from "@/components/organizer-cta";
import { getOwnedOrganizers, getProfile } from "@/lib/auth/dal";
import { listCategories, listEvents } from "@/lib/db/events";
import { listHomeOrganizers } from "@/lib/db/organizers";
import { toggleFollow } from "@/lib/db/follow-actions";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/** Prénom affiché dans la salutation, à défaut le début de l'adresse. */
function displayName(fullName: string | null, email: string | null): string {
  const source = fullName?.trim() || email?.split("@")[0] || "";
  return source.split(" ")[0];
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const t = await getTranslations("app");
  const tEvents = await getTranslations("events");
  const activeLocale = (await getLocale()) as Locale;

  const [profile, popularEvents, categories, organizers, ownedOrganizers] =
    await Promise.all([
      getProfile(),
      listEvents({ limit: 4 }),
      listCategories(),
      listHomeOrganizers(),
      getOwnedOrganizers(),
    ]);

  const name = profile ? displayName(profile.full_name, profile.email) : "";

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* L'atmosphère de l'écran : deux nappes de marque, très diffuses.
          Elles donnent la profondeur que le noir plat n'a pas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full opacity-30 blur-[90px]"
        style={{
          background: "radial-gradient(circle, #ff6b35 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-[28%] h-[460px] w-[460px] rounded-full opacity-25 blur-[90px]"
        style={{
          background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col px-5 pb-10 pt-6">
        {profile && (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[14px] font-semibold text-mist">
              {t("hello")} <span className="text-white">{name}</span>
            </p>
            <span
              aria-hidden
              className="grad-ember font-display flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
            >
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Héros */}
        <section className={profile ? "mt-5" : "mt-3"}>
          <h1 className="font-display text-[38px] font-extrabold uppercase leading-[1.02] sm:text-5xl">
            {t("heroA")}
            <br />
            {t("heroB")}
            <br />
            <span className="text-ember">{t("heroC")}</span>
          </h1>

          <div className="sheen mt-6 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-[13px]">
            <span
              aria-hidden
              className="grad-heat flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
            >
              <HotIcon size={16} strokeWidth={2.4} />
            </span>
            <span className="text-fog">{t("notif")}</span>
          </div>

          <Link
            href="/decouvrir"
            className="press mt-3 flex items-center gap-3 rounded-full bg-surface-high px-4 py-3.5 text-[14px] text-mist ring-1 ring-white/10 transition-colors hover:text-white hover:ring-brand/40"
          >
            <SearchIcon size={17} strokeWidth={2} aria-hidden />
            {t("searchPh")}
          </Link>
        </section>

        {/* Événements populaires */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[17px] font-extrabold">
              {tEvents("popular")}
            </h2>
            <Link
              href="/decouvrir"
              className="flex shrink-0 items-center gap-0.5 text-[12px] font-bold text-brand-bright hover:underline"
            >
              {tEvents("seeAll")}
              <NextIcon size={14} strokeWidth={2.5} aria-hidden />
            </Link>
          </div>

          {popularEvents.length === 0 ? (
            <p className="mt-4 rounded-card bg-surface p-6 text-center text-[14px] text-mist">
              {tEvents("empty")}
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
              {popularEvents.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} />
              ))}
            </div>
          )}
        </section>

        {/* Catégories */}
        {categories.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[17px] font-extrabold">
              {t("categories")}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {categories.slice(0, 4).map((category) => (
                <Link
                  key={category.key}
                  href={`/decouvrir?categorie=${category.key}`}
                  className="press sheen flex items-center gap-3 overflow-hidden rounded-card bg-surface px-3.5 py-3 text-[13px] font-bold transition-colors hover:bg-surface-high"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[15px]"
                  >
                    {category.emoji}
                  </span>
                  <span className="truncate">
                    {activeLocale === "fr"
                      ? category.label_fr
                      : category.label_en}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Organisateurs suivis, ou suggestions */}
        {organizers.organizers.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[17px] font-extrabold">
              {organizers.followed ? t("followed") : tEvents("organizers")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {organizers.organizers.map((organizer) => (
                <li
                  key={organizer.id}
                  className="sheen flex items-center gap-3 rounded-card bg-surface px-3.5 py-3"
                >
                  <Link
                    href={`/organisateurs/${organizer.slug}`}
                    className="press flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg"
                      style={{
                        background: organizer.gradient ?? FALLBACK_GRADIENT,
                      }}
                    >
                      {organizer.glyph ?? "🎪"}
                    </span>

                    <span className="flex min-w-0 flex-1 items-center gap-1 truncate text-[13px] font-bold">
                      <span className="truncate">{organizer.name}</span>
                      {organizer.verified && (
                        <DoneIcon
                          size={13}
                          strokeWidth={3}
                          className="shrink-0 text-accent"
                          aria-hidden
                        />
                      )}
                    </span>
                  </Link>

                  <form action={toggleFollow}>
                    <input
                      type="hidden"
                      name="organizerId"
                      value={organizer.id}
                    />
                    <input
                      type="hidden"
                      name="following"
                      value={organizer.following ? "1" : "0"}
                    />
                    <button
                      type="submit"
                      className={`press rounded-full px-4 py-2 text-[11px] font-bold transition-colors ${
                        organizer.following
                          ? "bg-white/5 text-mist ring-1 ring-white/12"
                          : "grad-ember text-white"
                      }`}
                    >
                      {organizer.following ? t("following") : t("follow")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ownedOrganizers.length === 0 && (
          <div className="mt-10">
            <OrganizerCta />
          </div>
        )}
      </div>
    </main>
  );
}
