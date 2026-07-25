import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatEventDateShort, formatPriceXaf } from "@/lib/format";
import { lowestPrice, type EventSummary } from "@/lib/db/events";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

export async function EventCard({ event }: { event: EventSummary }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("events");
  const from = lowestPrice(event);

  return (
    <Link
      href={`/evenements/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-card transition-colors hover:border-brand/50"
    >
      <div
        className="flex h-28 items-center justify-center text-4xl"
        style={{ background: event.gradient ?? FALLBACK_GRADIENT }}
        aria-hidden
      >
        {event.glyph ?? "🎟"}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
          {formatEventDateShort(event.starts_at, locale)}
        </div>

        <h3 className="font-display mt-1.5 text-[15px] font-extrabold leading-snug">
          {event.title}
        </h3>

        <p className="mt-1 text-[13px] text-mist">
          {event.city} · {event.venue}
        </p>

        <div className="mt-3 flex items-center justify-between pt-1">
          <span className="text-[13px] font-semibold">
            {Number.isFinite(from)
              ? t("fromPrice", { price: formatPriceXaf(from) })
              : t("freeEntry")}
          </span>
          <span className="text-[12px] text-smoke">{event.organizers.name}</span>
        </div>
      </div>
    </Link>
  );
}
