import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { PassIcon } from "@/components/icons";
import { Sticker, type StickerTone } from "@/components/sticker";
import { requireProfile } from "@/lib/auth/dal";
import { getMyPass, type PassLevel } from "@/lib/db/pass";
import { listCategories } from "@/lib/db/events";
import { formatEventDateShort } from "@/lib/format";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/**
 * Le métal de chaque palier.
 *
 * Un aplat de couleur ne fait pas une carte de membre : le métal se
 * reconnaît à ses bandes — sombre, clair, éclat, sombre à nouveau —
 * selon l'angle de la lumière. D'où cinq arrêts plutôt que deux, avec
 * un éclat franc autour de 46 %.
 *
 * Il ne sert jamais de fond : la carte reste sombre, et le métal
 * n'apparaît qu'en halo, en liseré et sur les chiffres. C'est ce qui
 * sépare une carte premium d'un rectangle colorié.
 */
const LEVEL_METAL: Record<PassLevel, string> = {
  bronze:
    "linear-gradient(135deg,#4A2409 0%,#C97B3C 28%,#F0B27A 46%,#A8541F 68%,#3D1D07 100%)",
  silver:
    "linear-gradient(135deg,#333C49 0%,#A0AEC0 28%,#EDF2F7 46%,#8595A8 68%,#2A323D 100%)",
  gold: "linear-gradient(135deg,#5A3706 0%,#D9A22B 28%,#F7DE8B 46%,#C88A1E 68%,#4A2D05 100%)",
};

/** L'éclat du palier, pour un liseré ou une pastille d'un seul ton. */
const LEVEL_ACCENT: Record<PassLevel, string> = {
  bronze: "#E08A4A",
  silver: "#C6D2E0",
  gold: "#F0C455",
};

/**
 * La teinte d'un badge se déduit de sa clé : une planche de stickers
 * tout orange serait plate, et tirer au sort les ferait changer de
 * couleur à chaque visite.
 */
const BADGE_TONES: StickerTone[] = ["ember", "heat", "night"];

function badgeTone(key: string): StickerTone {
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) sum += key.charCodeAt(i);
  return BADGE_TONES[sum % BADGE_TONES.length];
}

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
    <main className="relative flex-1 overflow-hidden">
      <span
        aria-hidden
        className="halo inset-x-0 -top-20 h-[280px] opacity-30"
        style={{ "--halo": "var(--grad-night)" } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        <h1 className="font-display text-[30px] font-extrabold uppercase">
          {tApp("passTab")}
        </h1>

        {isEmpty ? (
          <div className="sheen mt-8 rounded-sheet bg-surface p-8 text-center">
            <Sticker tone="night" size="lg" className="mx-auto">
              <PassIcon size={30} strokeWidth={2.2} />
            </Sticker>
            <p className="mt-5 text-[15px] font-semibold">{t("empty")}</p>
            <p className="mt-2 text-[13px] text-mist">{t("emptyHint")}</p>
            <Link
              href="/decouvrir"
              className="press grad-ember glow-brand font-display mt-6 inline-block rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white"
            >
              {t("browse")}
            </Link>
          </div>
        ) : (
          <>
            {/* ── Carte du passeport ─────────────────────────────────── */}
            <section
              className="relative mt-6 overflow-hidden rounded-sheet bg-surface-high p-6 text-white"
              style={{
                // Les deux ombres tiennent dans la même déclaration : une
                // seconde `box-shadow` écraserait la première, et la carte
                // perdrait soit son liseré, soit sa profondeur.
                boxShadow: `inset 0 0 0 1px ${LEVEL_ACCENT[pass.level]}40, 0 28px 70px -26px rgb(0 0 0 / 0.95)`,
              }}
            >
              {/* Le métal, en nappe : il éclaire la carte par le coin
                  plutôt que de la recouvrir. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-60 blur-[62px]"
                style={{ background: LEVEL_METAL[pass.level] }}
              />
              {/* Le balayage de lumière d'une carte tenue en main. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 32%, #FFFFFF 47%, transparent 62%)",
                }}
              />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-[9px] w-[9px] rounded-full"
                    style={{ background: LEVEL_ACCENT[pass.level] }}
                  />
                  <span className="font-display text-[13px] font-extrabold tracking-[0.2em]">
                    SPOT PASS
                  </span>
                </div>

                {/* Le palier, gravé dans le métal. */}
                <span
                  className="font-display rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]"
                  style={{
                    backgroundImage: LEVEL_METAL[pass.level],
                    color: "#0B0B0F",
                  }}
                >
                  {levelLabel}
                </span>
              </div>

              <p
                className="font-display relative mt-5 inline-block text-[62px] font-extrabold leading-none"
                style={{
                  backgroundImage: LEVEL_METAL[pass.level],
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {pass.points.toLocaleString("fr-FR")}
              </p>
              <p className="relative mt-1 text-[13px] text-mist">
                {tApp("points")}
              </p>

              <div className="relative mt-6 grid grid-cols-3 gap-2">
                <Stat value={pass.eventsLived} label={tApp("eventsLived")} />
                <Stat value={pass.cities} label={tApp("cities")} />
                <Stat value={levelLabel} label={tApp("level")} />
              </div>

              {/* La progression, lue d'un trait plutôt que d'une phrase. */}
              {pass.nextLevelAt !== null && (
                <div
                  aria-hidden
                  className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((pass.points / pass.nextLevelAt) * 100))}%`,
                      backgroundImage: LEVEL_METAL[pass.level],
                    }}
                  />
                </div>
              )}

              <p className="relative mt-3 text-[12px] text-mist">
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
                <p className="relative mt-1.5 text-[12px] text-smoke">
                  {tApp("topCategory")} : {topCategory.emoji}{" "}
                  {activeLocale === "fr"
                    ? topCategory.label_fr
                    : topCategory.label_en}
                </p>
              )}
            </section>

            {/* ── Badges ─────────────────────────────────────────────── */}
            <section className="mt-9">
              <h2 className="font-display text-[17px] font-extrabold">
                {tApp("badges")}
              </h2>
              <ul className="mt-4 flex gap-3 overflow-x-auto pb-2">
                {pass.badges.map((badge) => (
                  <li
                    key={badge.key}
                    className={`flex w-[96px] shrink-0 flex-col items-center gap-2.5 rounded-card bg-surface p-3 pt-4 text-center ${
                      badge.unlocked ? "" : "opacity-50"
                    }`}
                  >
                    <Sticker
                      tone={badgeTone(badge.key)}
                      seed={badge.key}
                      muted={!badge.unlocked}
                    >
                      {badge.emoji}
                    </Sticker>
                    <span className="text-[11px] font-bold leading-tight">
                      {t(`badgeNames.${badge.key}`)}
                    </span>
                    {!badge.unlocked && (
                      <span className="text-[10px] text-smoke">
                        {t("locked")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Moments vécus ──────────────────────────────────────── */}
            <section className="mt-9">
              <h2 className="font-display text-[17px] font-extrabold">
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
                        className="press sheen flex items-center gap-4 rounded-card bg-surface p-3.5 transition-colors hover:bg-surface-high"
                      >
                        <span
                          aria-hidden
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                          style={{
                            background: stamp.gradient ?? FALLBACK_GRADIENT,
                          }}
                        >
                          {stamp.glyph ?? "🎟"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-display block truncate text-[15px] font-extrabold">
                            {stamp.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-mist">
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
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-2.5 text-center ring-1 ring-inset ring-white/10">
      <div className="font-display text-[17px] font-extrabold leading-tight">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-mist">{label}</div>
    </div>
  );
}
