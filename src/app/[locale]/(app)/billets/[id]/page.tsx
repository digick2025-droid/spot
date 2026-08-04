import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { getMyTicket } from "@/lib/db/tickets";
import { formatEventDate } from "@/lib/format";
import { ticketQrSvg } from "@/lib/qr";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireProfile();

  // La RLS ne rend visible que ses propres billets : un identifiant
  // d'autrui ressort simplement introuvable.
  const ticket = await getMyTicket(id);
  if (!ticket) notFound();

  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("tickets");
  const qrSvg = await ticketQrSvg(ticket.code, ticket.secret);

  const spent = ticket.status !== "valid";

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-6 py-8">
      <Link
        href="/billets"
        className="text-[13px] font-semibold text-mist hover:text-white"
      >
        ← {t("backToTickets")}
      </Link>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-card">
        <div className="p-6 text-center">
          <h1 className="font-display text-xl font-extrabold leading-tight">
            {ticket.events.title}
          </h1>
          <p className="mt-2 text-[13px] text-mist">
            {formatEventDate(ticket.events.starts_at, activeLocale)}
          </p>
          <p className="text-[13px] text-mist">
            {ticket.events.venue} · {ticket.events.city}
          </p>
          <p className="mt-3 inline-block rounded-full bg-brand/15 px-3 py-1 text-[12px] font-semibold text-brand">
            {activeLocale === "fr"
              ? ticket.ticket_types.name_fr
              : ticket.ticket_types.name_en}
          </p>
        </div>

        {/* Découpe façon ticket */}
        <div className="relative h-6" aria-hidden>
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-white/15" />
          <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />
          <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />
        </div>

        <div className="px-6 pb-6">
          <div
            className={`mx-auto w-full max-w-[240px] rounded-2xl bg-white p-3 transition-opacity ${
              spent ? "opacity-30" : ""
            }`}
            // Le SVG est produit côté serveur par la bibliothèque qrcode à
            // partir de nos seules données : aucune entrée utilisateur ne
            // s'y retrouve.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <p className="mt-4 text-center font-mono text-lg font-bold tracking-[0.2em]">
            {ticket.code}
          </p>
          <p className="text-center text-[11px] uppercase tracking-wide text-smoke">
            {t("ticketCode")}
          </p>

          {spent ? (
            <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-[13px] text-mist">
              {ticket.status === "used"
                ? ticket.scanned_at
                  ? t("scannedAt", {
                      date: formatEventDate(ticket.scanned_at, activeLocale),
                    })
                  : t("used")
                : t("void")}
            </p>
          ) : (
            <p className="mt-4 text-center text-[12px] leading-relaxed text-smoke">
              {t("qrHint")}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
