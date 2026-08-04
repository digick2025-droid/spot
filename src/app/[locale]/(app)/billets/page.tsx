import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { TicketIcon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { requireProfile } from "@/lib/auth/dal";
import { listMyTickets } from "@/lib/db/tickets";
import { formatEventDate } from "@/lib/format";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

export default async function MyTicketsPage({
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
  const t = await getTranslations("tickets");
  const tickets = await listMyTickets();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10 pt-6">
      <h1 className="font-display text-[30px] font-extrabold uppercase">
        {t("title")}
      </h1>

      {tickets.length === 0 ? (
        <div className="mt-8 rounded-[20px] border border-white/10 bg-card p-8 text-center">
          <div className="text-4xl" aria-hidden>
            🎟
          </div>
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
        <ul className="mt-6 flex flex-col gap-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/billets/${ticket.id}`}
                className="press sheen flex items-center gap-4 rounded-card bg-surface p-3.5 transition-colors hover:bg-surface-high"
              >
                <span
                  aria-hidden
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
                  style={{ background: ticket.events.gradient ?? FALLBACK_GRADIENT }}
                >
                  {ticket.events.glyph ?? "🎟"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="font-display block truncate text-[15px] font-extrabold">
                    {ticket.events.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-mist">
                    {formatEventDate(ticket.events.starts_at, activeLocale)}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-smoke">
                    {activeLocale === "fr"
                      ? ticket.ticket_types.name_fr
                      : ticket.ticket_types.name_en}{" "}
                    · {ticket.code}
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    ticket.status === "valid"
                      ? "bg-success/15 text-success"
                      : ticket.status === "used"
                        ? "bg-white/10 text-mist"
                        : "bg-danger/15 text-danger"
                  }`}
                >
                  {t(ticket.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
