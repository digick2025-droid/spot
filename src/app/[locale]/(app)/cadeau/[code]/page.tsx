import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { GiftIcon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { getUser } from "@/lib/auth/dal";
import { getGiftPreview } from "@/lib/db/gifts";
import { formatEventDate, isEventOver } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { ClaimForm } from "./claim-form";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/**
 * Un cadeau ne s'indexe pas : le lien n'est protégé que par son code, et
 * un moteur qui le référencerait le rendrait public.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * L'écran d'un billet offert.
 *
 * Il s'ouvre souvent depuis WhatsApp, sur le téléphone de quelqu'un qui
 * n'a pas de compte et ne connaît pas SPOT : il doit donc dire en une
 * vue de quoi il s'agit — quelle soirée, offerte par qui — avant de
 * demander quoi que ce soit. La connexion ne vient qu'ensuite, et
 * ramène ici plutôt qu'à l'accueil.
 */
export default async function GiftPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const gift = await getGiftPreview(code);
  if (!gift) notFound();

  const activeLocale = (await getLocale()) as Locale;
  const t = await getTranslations("gift");
  const tEvents = await getTranslations("events");
  const user = await getUser();

  const gradient = gift.event.gradient ?? FALLBACK_GRADIENT;
  const poster = posterUrl(gift.event.posterPath);
  const over = isEventOver(gift.event.startsAt);
  const ticketTypeName =
    activeLocale === "fr" ? gift.ticketTypeNameFr : gift.ticketTypeNameEn;

  // Réclamé, terminé, annulé : trois raisons de ne rien proposer. La
  // page reste lisible dans tous les cas — on ne renvoie pas quelqu'un
  // sur une erreur nue alors qu'on lui a offert quelque chose.
  const closed = gift.claimed || over || gift.status !== "valid";

  return (
    <main className="relative flex-1 overflow-hidden">
      <span
        aria-hidden
        className={`halo inset-x-0 -top-16 h-[280px] ${closed ? "opacity-15" : "opacity-45"}`}
        style={{ "--halo": gradient } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-sm px-5 pb-10 pt-8 text-center">
        <Sticker tone="ember" size="lg" className="mx-auto">
          <GiftIcon size={30} strokeWidth={2.2} />
        </Sticker>

        <h1 className="font-display mt-5 text-[26px] font-extrabold uppercase leading-tight">
          {t("claimTitle")}
        </h1>
        <p className="mt-2 text-[14px] text-mist">
          {gift.fromName
            ? t("claimFrom", { name: gift.fromName })
            : t("claimFromAnonymous")}
        </p>
        {gift.recipientName && (
          <p className="text-[13px] text-smoke">
            {t("claimForYou", { name: gift.recipientName })}
          </p>
        )}

        {/* La pochette : ce qu'on offre, c'est une soirée. */}
        <div
          className="relative mx-auto mt-7 flex aspect-square w-full items-center justify-center overflow-hidden rounded-sheet text-6xl shadow-[0_28px_70px_-24px_rgb(0_0_0/0.9)]"
          style={{ background: gradient }}
          aria-hidden
        >
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 384px"
              className={`object-cover ${closed ? "opacity-50 grayscale" : ""}`}
            />
          ) : (
            (gift.event.glyph ?? "🎟")
          )}
        </div>

        <h2 className="font-display mt-5 text-[19px] font-extrabold leading-tight">
          {gift.event.title}
        </h2>
        <p className="mt-1.5 text-[13px] text-mist">
          {formatEventDate(gift.event.startsAt, activeLocale)}
        </p>
        <p className="text-[13px] text-smoke">
          {gift.event.venue} · {gift.event.city}
        </p>
        <p className="mt-3">
          <span className="inline-block rounded-full bg-brand/15 px-3 py-1 text-[12px] font-bold text-brand-bright">
            {ticketTypeName}
          </span>
        </p>

        {/* Le mot de celui qui offre : c'est le cadeau autant que la
            place. Il vient de lui, donc il est rendu en texte brut. */}
        {gift.message && (
          <p className="sheen mt-6 whitespace-pre-line rounded-card bg-surface px-5 py-4 text-left text-[14px] leading-relaxed text-fog">
            {gift.message}
          </p>
        )}

        {closed ? (
          <div className="sheen mt-7 rounded-card bg-surface px-5 py-4">
            <p className="text-[14px] font-semibold">
              {over
                ? t("eventOver")
                : gift.claimed
                  ? t("errors.GIFT_ALREADY_CLAIMED")
                  : t("errors.GIFT_NOT_VALID")}
            </p>
            <Link
              href="/decouvrir"
              className="press font-display mt-4 inline-block rounded-2xl bg-surface-high px-5 py-3 text-[14px] font-extrabold ring-1 ring-inset ring-white/10"
            >
              {tEvents("backToEvents")}
            </Link>
          </div>
        ) : user ? (
          <ClaimForm code={code} />
        ) : (
          <Link
            href={{ pathname: "/connexion", query: { suite: `/cadeau/${code}` } }}
            className="press grad-ember glow-brand font-display mt-7 block rounded-2xl px-4 py-4 text-[15px] font-extrabold text-white"
          >
            {t("claimSignIn")}
          </Link>
        )}
      </div>
    </main>
  );
}
