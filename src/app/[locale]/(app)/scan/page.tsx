import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { listScannableEvents } from "@/lib/db/scan";
import { formatEventDate } from "@/lib/format";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

export default async function ScanIndexPage({
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
  const t = await getTranslations("scan");
  const events = await listScannableEvents();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-2 text-[14px] text-mist">{t("chooseEvent")}</p>

      {events.length === 0 ? (
        <div className="mt-8 rounded-[20px] border border-white/10 bg-card p-8 text-center">
          <p className="text-[15px] font-semibold">{t("noEvents")}</p>
          <p className="mt-2 text-[13px] text-mist">{t("noEventsHint")}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/scan/${event.slug}`}
                className="flex items-center gap-4 rounded-[20px] border border-white/10 bg-card p-4 transition-colors hover:border-brand/50"
              >
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
                  style={{ background: event.gradient ?? FALLBACK_GRADIENT }}
                >
                  {event.glyph ?? "🎟"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate text-[15px] font-extrabold">
                    {event.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-mist">
                    {formatEventDate(event.starts_at, activeLocale)} · {event.city}
                  </span>
                </span>
                <span aria-hidden className="text-mist">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
