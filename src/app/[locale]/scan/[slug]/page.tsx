import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { eventScanCounts, listScannableEvents } from "@/lib/db/scan";
import { ScanConsole } from "./scan-console";

export default async function ScanEventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireProfile();

  // listScannableEvents passe par la RLS : un événement qu'on n'organise
  // pas n'y figure pas, donc l'accès direct par URL tombe en 404.
  const events = await listScannableEvents();
  const event = events.find((e) => e.slug === slug);
  if (!event) notFound();

  const t = await getTranslations("scan");
  const counts = await eventScanCounts(event.id);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-8">
      <Link
        href="/scan"
        className="text-[13px] font-semibold text-mist hover:text-white"
      >
        ← {t("backToEvents")}
      </Link>

      <h1 className="font-display mt-4 text-2xl font-extrabold uppercase leading-tight tracking-tight">
        {event.title}
      </h1>
      <p className="mt-1 text-[13px] text-mist">
        {event.venue} · {event.city}
      </p>

      <div className="mt-5 flex items-baseline gap-2 rounded-2xl border border-white/10 bg-card px-4 py-3">
        <span className="font-display text-3xl font-extrabold text-brand">
          {counts.used}
        </span>
        <span className="text-[13px] text-mist">
          {t("scanned")} {t("ofTotal", { total: counts.total })}
        </span>
      </div>

      <ScanConsole eventId={event.id} />
    </main>
  );
}
