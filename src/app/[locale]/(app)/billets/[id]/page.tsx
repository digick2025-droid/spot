import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { BackIcon, DoneIcon } from "@/components/icons";
import { requireProfile } from "@/lib/auth/dal";
import { getMyTicket } from "@/lib/db/tickets";
import { formatEventDate } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { ticketQrSvg } from "@/lib/qr";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/**
 * Le billet — ce qu'on possède d'un événement.
 *
 * Il garde la forme d'un vrai ticket : une souche qui porte l'affiche et
 * le nom de la soirée, une perforation, puis le talon qu'on présente à
 * l'entrée. Le QR n'a pas de concurrent en bas de carte : c'est le seul
 * élément que le portier cherche, souvent dans le noir et en dix
 * secondes, d'où le blanc franc et la taille pleine largeur.
 */
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

  const gradient = ticket.events.gradient ?? FALLBACK_GRADIENT;
  const poster = posterUrl(ticket.events.poster_path);
  const spent = ticket.status !== "valid";

  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Le halo de l'événement : le billet garde la couleur de la soirée
          à laquelle il donne accès. Éteint une fois le billet consommé. */}
      <span
        aria-hidden
        className={`halo inset-x-0 -top-16 h-[260px] ${spent ? "opacity-10" : "opacity-40"}`}
        style={{ "--halo": gradient } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-sm px-5 pb-10 pt-4">
        <Link
          href="/billets"
          className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-mist hover:text-white"
        >
          <BackIcon size={16} strokeWidth={2.2} aria-hidden />
          {t("backToTickets")}
        </Link>

        <article className="mt-4 overflow-hidden rounded-sheet bg-surface-high shadow-[0_28px_70px_-26px_rgb(0_0_0/0.95)]">
          {/* ── Souche : de quoi ce billet est le billet ─────────────── */}
          <div className="sheen relative flex items-center gap-3.5 p-5">
            <span
              aria-hidden
              className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl"
              style={{ background: gradient }}
            >
              {poster ? (
                <Image
                  src={poster}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                (ticket.events.glyph ?? "🎟")
              )}
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="font-display line-clamp-2 text-[17px] font-extrabold leading-tight">
                {ticket.events.title}
              </h1>
              <p className="mt-1 text-[12px] text-mist">
                {formatEventDate(ticket.events.starts_at, activeLocale)}
              </p>
              <p className="truncate text-[12px] text-smoke">
                {ticket.events.venue} · {ticket.events.city}
              </p>
            </div>
          </div>

          <p className="px-5">
            <span className="inline-block rounded-full bg-brand/15 px-3 py-1 text-[12px] font-bold text-brand-bright">
              {activeLocale === "fr"
                ? ticket.ticket_types.name_fr
                : ticket.ticket_types.name_en}
            </span>
          </p>

          {/* La perforation : les encoches sont de la couleur du fond de
              page, ce qui donne l'illusion d'un billet détaché. */}
          <div className="relative mt-5 h-6" aria-hidden>
            <div className="absolute inset-x-5 top-1/2 border-t border-dashed border-white/15" />
            <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />
            <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-ink" />
          </div>

          {/* ── Talon : ce que le portier scanne ─────────────────────── */}
          <div className="px-5 pb-6">
            <div className="relative">
              <div
                className={`mx-auto w-full rounded-2xl bg-white p-4 transition-opacity ${
                  spent ? "opacity-20" : ""
                }`}
                // Le SVG est produit côté serveur par la bibliothèque qrcode à
                // partir de nos seules données : aucune entrée utilisateur ne
                // s'y retrouve.
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />

              {/* Le tampon du videur : un billet déjà passé se voit d'un
                  coup d'œil, sans avoir à lire la ligne d'explication. */}
              {spent && (
                <span
                  aria-hidden
                  className="font-display absolute inset-0 m-auto flex h-fit w-fit -rotate-12 items-center gap-2 rounded-xl border-[3px] border-current px-4 py-2 text-[15px] font-extrabold uppercase tracking-[0.12em] text-mist"
                >
                  {ticket.status === "used" && (
                    <DoneIcon size={17} strokeWidth={3} />
                  )}
                  {t(ticket.status)}
                </span>
              )}
            </div>

            <p className="mt-4 text-center font-mono text-lg font-bold tracking-[0.2em]">
              {ticket.code}
            </p>
            <p className="text-center text-[11px] uppercase tracking-wide text-smoke">
              {t("ticketCode")}
            </p>

            {spent ? (
              <p className="mt-4 rounded-xl bg-white/[0.04] px-4 py-3 text-center text-[13px] text-mist ring-1 ring-inset ring-white/10">
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
        </article>
      </div>
    </main>
  );
}
