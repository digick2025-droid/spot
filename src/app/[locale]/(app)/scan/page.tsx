import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { NextIcon, ScanIcon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10 pt-6">
      <h1 className="font-display text-[30px] font-extrabold uppercase">
        {t("title")}
      </h1>
      <p className="mt-2 text-[14px] text-mist">{t("chooseEvent")}</p>

      {events.length === 0 ? (
        <div className="sheen mt-8 rounded-sheet bg-surface p-8 text-center">
          <Sticker tone="ember" size="lg" className="mx-auto">
            <ScanIcon size={30} strokeWidth={2.2} />
          </Sticker>
          <p className="mt-5 text-[15px] font-semibold">{t("noEvents")}</p>
          <p className="mt-2 text-[13px] text-mist">{t("noEventsHint")}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/scan/${event.slug}`}
                className="press sheen flex items-center gap-4 rounded-card bg-surface p-4 transition-colors hover:bg-surface-high"
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
                  <span className="mt-0.5 block truncate text-[12px] text-mist">
                    {formatEventDate(event.starts_at, activeLocale)} ·{" "}
                    {event.city}
                  </span>
                </span>
                <NextIcon
                  size={18}
                  strokeWidth={2.4}
                  className="shrink-0 text-smoke"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
