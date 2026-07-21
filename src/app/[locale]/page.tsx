import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

// Vérifie que l'instance Supabase répond (page de démonstration Phase 0).
async function checkSupabase(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      next: { revalidate: 60 },
    });
    return res.ok;
  } catch {
    return false;
  }
}

const SPACES = [
  { emoji: "🎟", titleKey: "participantTitle", descKey: "participantDesc" },
  { emoji: "📊", titleKey: "organizerTitle", descKey: "organizerDesc" },
  { emoji: "📣", titleKey: "creatorTitle", descKey: "creatorDesc" },
  { emoji: "🛠", titleKey: "adminTitle", descKey: "adminDesc" },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }
  const t = await getTranslations("home");
  const tApp = await getTranslations("app");
  const supabaseOk = await checkSupabase();

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

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-8">
        {/* En-tête : logo + sélecteur de langue */}
        <header className="flex items-center justify-between">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            SP<span className="spot-dot mx-0.5" aria-hidden />T
          </div>
          <nav className="flex gap-1 rounded-full bg-card p-1 text-xs font-semibold">
            <Link
              href="/"
              locale="fr"
              className={`rounded-full px-3 py-1.5 transition-colors ${
                locale === "fr" ? "bg-brand text-white" : "text-mist"
              }`}
            >
              FR
            </Link>
            <Link
              href="/"
              locale="en"
              className={`rounded-full px-3 py-1.5 transition-colors ${
                locale === "en" ? "bg-brand text-white" : "text-mist"
              }`}
            >
              EN
            </Link>
          </nav>
        </header>

        {/* Héros */}
        <section className="mt-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-card px-4 py-1.5 text-xs font-semibold text-fog">
            ⚡ {t("phaseBadge")}
          </span>
          <h1 className="font-display mt-6 text-4xl font-extrabold uppercase leading-[1.08] tracking-tight sm:text-5xl">
            {tApp("heroA")}
            <br />
            {tApp("heroB")}
            <br />
            <span className="text-brand">{tApp("heroC")}</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-mist">
            {t("tagline")}
          </p>
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-accent/35 bg-card px-4 py-3 text-[13px]">
            🔥 <span>{tApp("notif")}</span>
          </div>
        </section>

        {/* Les 4 espaces */}
        <section className="mt-12">
          <h2 className="font-display text-[15px] font-extrabold">
            {t("spacesTitle")}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SPACES.map((s) => (
              <div
                key={s.titleKey}
                className="rounded-[20px] border border-white/10 bg-card p-5"
              >
                <div className="text-2xl">{s.emoji}</div>
                <div className="font-display mt-3 text-[15px] font-extrabold">
                  {t(s.titleKey)}
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mist">
                  {t(s.descKey)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Pied de page */}
        <footer className="mt-12 flex flex-col gap-3 border-t border-white/10 pb-4 pt-6 text-[13px] text-smoke">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>📍 {t("citiesNote")}</span>
            <span>💳 {t("paymentNote")}</span>
            <span
              className={`inline-flex items-center gap-1.5 ${
                supabaseOk ? "text-success" : "text-warning"
              }`}
            >
              ● {supabaseOk ? t("supabaseOk") : t("supabaseKo")}
            </span>
          </div>
          <div>{t("footer")}</div>
        </footer>
      </div>
    </main>
  );
}
