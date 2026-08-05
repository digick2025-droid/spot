import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { BackIcon } from "@/components/icons";
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
    <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-10 pt-4">
      <Link
        href="/scan"
        className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mist hover:text-white"
      >
        <BackIcon size={16} strokeWidth={2.2} aria-hidden />
        {t("backToEvents")}
      </Link>

      <h1 className="font-display mt-4 text-2xl font-extrabold uppercase leading-tight">
        {event.title}
      </h1>
      <p className="mt-1 text-[13px] text-mist">
        {event.venue} · {event.city}
      </p>

      {/* Le compteur d'entrées : la seule statistique qui compte pendant
          que la file avance. */}
      <div className="sheen mt-5 flex items-baseline gap-2 rounded-card bg-surface px-5 py-4">
        <span className="text-ember font-display text-3xl font-extrabold">
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
