import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { EventCard } from "@/components/event-card";
import { getProfile } from "@/lib/auth/dal";
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

  const [profile, popularEvents, categories, organizers] = await Promise.all([
    getProfile(),
    listEvents({ limit: 4 }),
    listCategories(),
    listHomeOrganizers(),
  ]);

  const name = profile ? displayName(profile.full_name, profile.email) : "";

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Dégradés radiaux de fond */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, #ff6b35 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/3 h-[520px] w-[520px] rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col px-6 py-8">
        {profile && (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-[15px] font-semibold text-mist">
              {t("hello")} {name} 👋
            </p>
            <span
              aria-hidden
              className="font-display flex h-[42px] w-[42px] items-center justify-center rounded-full bg-brand text-[16px] font-extrabold text-ink"
            >
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Héros */}
        <section className={profile ? "mt-4" : "mt-6"}>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-[1.08] tracking-tight sm:text-5xl">
            {t("heroA")}
            <br />
            {t("heroB")}
            <br />
            <span className="text-brand">{t("heroC")}</span>
          </h1>

          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/35 bg-card px-4 py-3 text-[13px]">
            🔥 <span>{t("notif")}</span>
          </div>

          <Link
            href="/decouvrir"
            className="mt-4 flex items-center gap-2.5 rounded-full border border-white/10 bg-card px-4 py-3 text-[14px] text-mist transition-colors hover:border-brand/40"
          >
            <span aria-hidden>🔍</span>
            {t("searchPh")}
          </Link>
        </section>

        {/* Événements populaires */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[15px] font-extrabold">
              {tEvents("popular")}
            </h2>
            <Link
              href="/decouvrir"
              className="text-[13px] font-semibold text-brand hover:underline"
            >
              {tEvents("seeAll")} →
            </Link>
          </div>

          {popularEvents.length === 0 ? (
            <p className="mt-4 rounded-[20px] border border-white/10 bg-card p-6 text-center text-[14px] text-mist">
              {tEvents("empty")}
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {popularEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

        {/* Catégories */}
        {categories.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[15px] font-extrabold">
              {t("categories")}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {categories.slice(0, 4).map((category) => (
                <Link
                  key={category.key}
                  href={`/decouvrir?categorie=${category.key}`}
                  className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-card px-3.5 py-3 text-[13px] font-semibold transition-colors hover:border-brand/40"
                >
                  <span aria-hidden>{category.emoji}</span>
                  {activeLocale === "fr" ? category.label_fr : category.label_en}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Organisateurs suivis, ou suggestions */}
        {organizers.organizers.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-[15px] font-extrabold">
              {organizers.followed ? t("followed") : tEvents("organizers")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {organizers.organizers.map((organizer) => (
                <li
                  key={organizer.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card px-3.5 py-3"
                >
                  <Link
                    href={`/organisateurs/${organizer.slug}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
                      style={{
                        background: organizer.gradient ?? FALLBACK_GRADIENT,
                      }}
                    >
                      {organizer.glyph ?? "🎪"}
                    </span>

                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                      {organizer.name}
                      {organizer.verified && (
                        <span aria-hidden className="ml-1 text-accent">
                          ✓
                        </span>
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
                      className={`rounded-full border px-3.5 py-1.5 text-[11px] font-bold transition-colors ${
                        organizer.following
                          ? "border-white/15 bg-white/5 text-mist"
                          : "border-brand bg-brand/10 text-brand hover:bg-brand/20"
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
      </div>
    </main>
  );
}
