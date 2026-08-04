import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { getMyPass, type PassLevel } from "@/lib/db/pass";
import { listCategories } from "@/lib/db/events";
import { formatEventDateShort } from "@/lib/format";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/** Chaque palier a sa couleur : le passeport doit se reconnaître d'un coup d'œil. */
const LEVEL_GRADIENT: Record<PassLevel, string> = {
  bronze: "linear-gradient(135deg,#B45309,#78350F)",
  silver: "linear-gradient(135deg,#94A3B8,#475569)",
  gold: "linear-gradient(135deg,#F59E0B,#B45309)",
};

export default async function PassPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireProfile();

  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("pass");
  const tApp = await getTranslations("app");

  const [pass, categories] = await Promise.all([getMyPass(), listCategories()]);

  const topCategory = categories.find((c) => c.key === pass.topCategoryKey);
  const levelLabel = t(`levels.${pass.level}`);
  const isEmpty = pass.stamps.length === 0 && pass.points === 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
        {tApp("passTab")}
      </h1>

      {isEmpty ? (
        <div className="mt-8 rounded-[20px] border border-white/10 bg-card p-8 text-center">
          <div className="text-4xl" aria-hidden>
            🎫
          </div>
          <p className="mt-4 text-[15px] font-semibold">{t("empty")}</p>
          <p className="mt-2 text-[13px] text-mist">{t("emptyHint")}</p>
          <Link
            href="/decouvrir"
            className="mt-5 inline-block rounded-2xl bg-brand px-5 py-3 font-display text-[14px] font-extrabold text-white hover:opacity-90"
          >
            {t("browse")}
          </Link>
        </div>
      ) : (
        <>
          {/* ── Carte du passeport ─────────────────────────────────── */}
          <section
            className="mt-6 rounded-[24px] p-6 text-white"
            style={{ background: LEVEL_GRADIENT[pass.level] }}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-[9px] w-[9px] rounded-full bg-white/90"
              />
              <span className="font-display text-[13px] font-extrabold tracking-[0.2em]">
                SPOT PASS
              </span>
            </div>

            <p className="font-display mt-4 text-5xl font-extrabold leading-none">
              {pass.points.toLocaleString("fr-FR")}
            </p>
            <p className="mt-1 text-[13px] text-white/80">{tApp("points")}</p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat value={pass.eventsLived} label={tApp("eventsLived")} />
              <Stat value={pass.cities} label={tApp("cities")} />
              <Stat value={levelLabel} label={tApp("level")} />
            </div>

            <p className="mt-4 text-[12px] text-white/80">
              {pass.nextLevelAt === null
                ? t("maxLevel")
                : t("nextLevel", {
                    points: pass.nextLevelAt - pass.points,
                    level: t(
                      `levels.${pass.level === "bronze" ? "silver" : "gold"}`
                    ),
                  })}
            </p>

            {topCategory && (
              <p className="mt-2 text-[12px] text-white/80">
                {tApp("topCategory")} : {topCategory.emoji}{" "}
                {activeLocale === "fr"
                  ? topCategory.label_fr
                  : topCategory.label_en}
              </p>
            )}
          </section>

          {/* ── Badges ─────────────────────────────────────────────── */}
          <section className="mt-8">
            <h2 className="font-display text-[15px] font-extrabold">
              {tApp("badges")}
            </h2>
            <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {pass.badges.map((badge) => (
                <li
                  key={badge.key}
                  className={`flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-2xl border p-3 text-center ${
                    badge.unlocked
                      ? "border-brand/50 bg-card"
                      : "border-white/10 bg-card opacity-40"
                  }`}
                >
                  <span aria-hidden className="text-2xl">
                    {badge.emoji}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">
                    {t(`badgeNames.${badge.key}`)}
                  </span>
                  {!badge.unlocked && (
                    <span className="text-[10px] text-smoke">{t("locked")}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* ── Moments vécus ──────────────────────────────────────── */}
          <section className="mt-8">
            <h2 className="font-display text-[15px] font-extrabold">
              {tApp("experiences")}
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {pass.stamps.map((stamp) => {
                const category = categories.find(
                  (c) => c.key === stamp.categoryKey
                );
                return (
                  <li key={stamp.eventId}>
                    <Link
                      href={`/evenements/${stamp.slug}`}
                      className="flex items-center gap-4 rounded-[20px] border border-white/10 bg-card p-4 transition-colors hover:border-brand/50"
                    >
                      <span
                        aria-hidden
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                        style={{ background: stamp.gradient ?? FALLBACK_GRADIENT }}
                      >
                        {stamp.glyph ?? "🎟"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-display block truncate text-[15px] font-extrabold">
                          {stamp.title}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-mist">
                          {category
                            ? `${activeLocale === "fr" ? category.label_fr : category.label_en} · `
                            : ""}
                          {stamp.city} ·{" "}
                          {formatEventDateShort(stamp.startsAt, activeLocale)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2.5 text-center">
      <div className="font-display text-[17px] font-extrabold leading-tight">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-white/75">{label}</div>
    </div>
  );
}
