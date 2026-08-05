import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { GiftIcon, TicketIcon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { GiftShare } from "@/components/gift-share";
import { requireProfile } from "@/lib/auth/dal";
import { listMyTickets } from "@/lib/db/tickets";
import { formatEventDate } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { getSiteUrl } from "@/lib/site-url";

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
  const tGift = await getTranslations("gift");
  const tickets = await listMyTickets();

  // Le lien d'un cadeau non réclamé reste ici : c'est là qu'on revient
  // quand le premier envoi s'est perdu dans une conversation.
  const giftBase = `${getSiteUrl()}${
    activeLocale === routing.defaultLocale ? "" : `/${activeLocale}`
  }/cadeau`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10 pt-6">
      <h1 className="font-display text-[30px] font-extrabold uppercase">
        {t("title")}
      </h1>

      {tickets.length === 0 ? (
        <div className="sheen mt-8 rounded-sheet bg-surface p-8 text-center">
          <Sticker tone="heat" size="lg" className="mx-auto">
            <TicketIcon size={30} strokeWidth={2.2} />
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
        <ul className="mt-6 flex flex-col gap-3">
          {tickets.map((ticket) => {
            const poster = posterUrl(ticket.events.poster_path);
            // Offert, mais pas encore réclamé : le billet est toujours à
            // nous, et il attend d'être envoyé.
            const pendingGift =
              ticket.gift_claim_code !== null && ticket.claimed_at === null;
            return (
              <li key={ticket.id}>
                <Link
                  href={`/billets/${ticket.id}`}
                  className="press sheen flex items-center gap-4 rounded-card bg-surface p-3.5 transition-colors hover:bg-surface-high"
                >
                  {/* La pochette de l'événement, en petit : c'est elle qu'on
                      reconnaît dans une liste, avant de lire le titre. */}
                  <span
                    aria-hidden
                    className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-2xl"
                    style={{
                      background: ticket.events.gradient ?? FALLBACK_GRADIENT,
                    }}
                  >
                    {poster ? (
                      <Image
                        src={poster}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : (
                      (ticket.events.glyph ?? "🎟")
                    )}
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
                      pendingGift
                        ? "bg-brand/15 text-brand-bright"
                        : ticket.status === "valid"
                          ? "bg-success/15 text-success"
                          : ticket.status === "used"
                            ? "bg-white/10 text-mist"
                            : "bg-danger/15 text-danger"
                    }`}
                  >
                    {pendingGift ? tGift("waiting") : t(ticket.status)}
                  </span>
                </Link>

                {/* Hors du lien : deux zones cliquables imbriquées ne
                    peuvent pas cohabiter, et c'est le partage qu'on vient
                    chercher ici, pas le QR d'un billet qu'on donne. */}
                {pendingGift && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-mist">
                      <GiftIcon size={14} strokeWidth={2.2} aria-hidden />
                      {ticket.gift_recipient_name
                        ? tGift("offeredTo", {
                            name: ticket.gift_recipient_name,
                          })
                        : tGift("shareTitle")}
                    </span>
                    <GiftShare
                      url={`${giftBase}/${ticket.gift_claim_code}`}
                      eventTitle={ticket.events.title}
                      className="bg-white/5 text-fog ring-1 ring-inset ring-white/12 hover:text-white"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
