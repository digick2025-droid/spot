import type { Metadata } from "next";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  Band,
  Card,
  Eyebrow,
  Perforation,
  Ticket,
  Wrap,
  ctaClassName,
} from "@/components/site/ui";
import { PaymentDemo } from "@/components/site/payment-demo";
import { listEvents, lowestPrice } from "@/lib/db/events";
import { formatEventDateShort, formatPriceXaf } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.home" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function LandingHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const t = await getTranslations("landing.home");
  const tNav = await getTranslations("landing.nav");
  const activeLocale = (await getLocale()) as Locale;

  // La bande « à l'affiche » montre de vrais événements publiés : une
  // vitrine qui promet des soirées inventées ne tiendrait pas au premier
  // clic. Sans catalogue, la bande disparaît et le billet du héros
  // retombe sur son illustration.
  const events = await listEvents({ limit: 6 });
  const headline = events[0];
  const headlinePrice = headline ? lowestPrice(headline) : Number.NaN;

  const chips = [
    { emoji: "🎵", label: t("chipConcerts") },
    { emoji: "🎓", label: t("chipTraining") },
    { emoji: "💼", label: t("chipBusiness") },
    { emoji: "🎭", label: t("chipCulture") },
    { emoji: "⚽", label: t("chipSports") },
    { emoji: "🤝", label: t("chipNetworking") },
    { emoji: "🙏", label: t("chipFaith") },
    { emoji: "🍽", label: t("chipFood") },
  ];

  const gate = [
    { label: t("gate1Num"), title: t("gate1Title"), body: t("gate1Body") },
    { label: t("gate2Num"), title: t("gate2Title"), body: t("gate2Body") },
    { label: t("gate3Num"), title: t("gate3Title"), body: t("gate3Body") },
  ];

  return (
    <>
      {/* ── Héros ────────────────────────────────────────────────── */}
      <Band className="overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 left-1/2 h-[420px] w-[min(760px,110vw)] -translate-x-1/2 blur-lg"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 100%, rgba(255,107,53,0.22), transparent 72%)",
          }}
        />
        <Wrap className="relative grid items-center gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1 className="font-display mb-[1.2rem] text-[clamp(2.5rem,6.8vw,4.7rem)] font-extrabold leading-none tracking-[-0.045em]">
              {t("titleA")}
              <br />
              {t("titleB")}
            </h1>
            <p className="max-w-[62ch] text-[clamp(1rem,1.45vw,1.18rem)] leading-relaxed text-mist">
              {t("lede")}
            </p>

            <div className="mt-[1.9rem] flex flex-wrap gap-2.5">
              <Link href="/accueil" className={ctaClassName("brand")}>
                {tNav("open")}
              </Link>
              <Link href="/organisateurs" className={ctaClassName("ghost")}>
                {t("ctaOrganizer")}
              </Link>
            </div>

            <div className="mt-[1.6rem] flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip.label}
                  className="whitespace-nowrap rounded-full border border-white/10 px-3.5 py-1.5 text-[0.78rem] font-semibold text-mist"
                >
                  <span aria-hidden>{chip.emoji}</span> {chip.label}
                </span>
              ))}
            </div>
          </div>

          <Ticket
            stub={
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-[0.13em] text-smoke">
                    {t("ticketFrom")}
                  </span>
                  <span className="font-display text-[1.35rem] font-extrabold tracking-tight tabular-nums text-brand">
                    {formatPriceXaf(
                      Number.isFinite(headlinePrice) ? headlinePrice : 5000
                    )}
                  </span>
                </div>
                <Link
                  href={
                    headline ? `/evenements/${headline.slug}` : "/decouvrir"
                  }
                  className={ctaClassName("brand")}
                >
                  {t("ticketCta")}
                </Link>
              </div>
            }
          >
            <span aria-hidden className="mb-3.5 block text-[2rem] leading-none">
              {headline?.glyph ?? "🎤"}
            </span>
            <p className="font-display mb-1 text-[1.45rem] font-extrabold tracking-tight">
              {headline?.title ?? t("ticketTitle")}
            </p>
            <p className="text-[0.83rem] text-mist">
              {headline
                ? `${formatEventDateShort(headline.starts_at, activeLocale)} · ${headline.venue}, ${headline.city}`
                : t("ticketMeta")}
            </p>
          </Ticket>
        </Wrap>
      </Band>

      <Perforation />

      {/* ── Le paiement, joué en trois écrans ────────────────────── */}
      <Band>
        <Wrap className="grid items-center gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="reveal">
            <Eyebrow>{t("payEyebrow")}</Eyebrow>
            <h2 className="font-display mb-4 text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
              {t("payTitleA")}
              <br />
              {t("payTitleB")}
            </h2>
            <p className="max-w-[62ch] text-[clamp(1rem,1.45vw,1.18rem)] leading-relaxed text-mist">
              {t("payLede")}
            </p>
            <p className="mt-5 max-w-[62ch] text-[0.93rem] text-mist">
              {t.rich("payRule", {
                strong: (chunks) => (
                  <strong className="text-white">{chunks}</strong>
                ),
              })}
            </p>
          </div>

          <div className="reveal">
            <PaymentDemo />
          </div>
        </Wrap>
      </Band>

      <Perforation />

      {/* ── Le soir venu ─────────────────────────────────────────── */}
      <Band tight>
        <Wrap>
          <Eyebrow>{t("gateEyebrow")}</Eyebrow>
          <h2 className="font-display max-w-[20ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
            {t("gateTitle")}
          </h2>
          <div className="reveal mt-[2.2rem] grid gap-4 md:grid-cols-3">
            {gate.map((item) => (
              <Card key={item.label} label={item.label} title={item.title}>
                {item.body}
              </Card>
            ))}
          </div>
        </Wrap>
      </Band>

      {/* ── À l'affiche : de vrais événements publiés ─────────────── */}
      {events.length > 0 && (
        <>
          <Perforation />
          <Band>
            <Wrap>
              <Eyebrow>{t("billEyebrow")}</Eyebrow>
              <h2 className="font-display max-w-[18ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
                {t("billTitle")}
              </h2>

              <div className="reveal mt-[2.2rem] grid gap-4 md:grid-cols-2">
                {events.map((event) => {
                  const from = lowestPrice(event);
                  return (
                    <Link
                      key={event.id}
                      href={`/evenements/${event.slug}`}
                      className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card px-[1.1rem] py-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-brand"
                    >
                      <span
                        aria-hidden
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-shell text-[1.25rem]"
                      >
                        {event.glyph ?? "🎟"}
                      </span>
                      <span className="hidden shrink-0 text-[0.72rem] font-bold uppercase tracking-wider tabular-nums text-smoke sm:block">
                        {formatEventDateShort(event.starts_at, activeLocale)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-display block truncate text-[0.98rem] font-extrabold tracking-tight">
                          {event.title}
                        </span>
                        <span className="block truncate text-[0.775rem] text-smoke">
                          {event.venue} · {event.city}
                        </span>
                      </span>
                      <span className="font-display shrink-0 text-right text-[0.88rem] font-extrabold tabular-nums text-brand">
                        {Number.isFinite(from)
                          ? from.toLocaleString("fr-FR")
                          : "—"}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <p className="mt-5 text-[0.8rem] tabular-nums text-smoke">
                {t("billNote")}
              </p>
            </Wrap>
          </Band>
        </>
      )}

      {/* ── Le visiteur venu d'un lien partagé ───────────────────── */}
      <Band tight>
        <Wrap className="grid items-center gap-[clamp(2rem,5vw,4rem)] md:grid-cols-2">
          <div className="reveal">
            <Eyebrow>{t("coldEyebrow")}</Eyebrow>
            <h2 className="font-display mb-4 max-w-[17ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
              {t("coldTitle")}
            </h2>
            <p className="max-w-[62ch] text-[clamp(1rem,1.45vw,1.18rem)] leading-relaxed text-mist">
              {t("coldLede")}
            </p>
          </div>

          <div className="reveal max-w-[420px] rounded-[20px] border border-white/10 bg-shell p-4">
            <p className="mb-3 pl-0.5 text-[0.7rem] uppercase tracking-[0.14em] text-smoke">
              {t("mockLabel")}
            </p>
            <div className="flex items-center gap-3.5 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/15 to-card px-[1.15rem] py-[1.05rem]">
              <span
                aria-hidden
                className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-brand text-[1.1rem]"
              >
                🎟
              </span>
              <span>
                <strong className="font-display block text-[0.92rem] font-extrabold tracking-tight">
                  {t("promoTitle")}
                </strong>
                <span className="mt-0.5 block text-[0.78rem] text-mist">
                  {t("promoBody")}
                </span>
              </span>
            </div>
          </div>
        </Wrap>
      </Band>

      <Perforation />

      {/* ── Sortie ───────────────────────────────────────────────── */}
      <Band tight>
        <Wrap className="text-center">
          <span className="font-display text-[clamp(3rem,10vw,6rem)] font-extrabold tracking-[-0.04em]">
            <span aria-hidden>
              SP<span className="spot-dot mx-0.5" />T
            </span>
          </span>
          <p className="mx-auto mt-5 max-w-[44ch] text-[clamp(1rem,1.45vw,1.18rem)] leading-relaxed text-mist">
            {t("outroLede")}
          </p>
          <div className="mt-[1.9rem] flex flex-wrap justify-center gap-2.5">
            <Link href="/accueil" className={ctaClassName("brand")}>
              {tNav("open")}
            </Link>
            <Link href="/decouvrir" className={ctaClassName("ghost")}>
              {t("outroSecondary")}
            </Link>
          </div>
        </Wrap>
      </Band>
    </>
  );
}
