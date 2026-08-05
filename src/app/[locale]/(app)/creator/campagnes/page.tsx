import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { CampaignIcon, DoneIcon, NextIcon } from "@/components/icons";
import { Sticker } from "@/components/sticker";
import { requireProfile } from "@/lib/auth/dal";
import { listOpenCampaigns, type CatalogCampaign } from "@/lib/db/campaign-catalog";
import { formatEventDateShort } from "@/lib/format";

const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#8B5CF6)";

/**
 * Catalogue des campagnes ouvertes.
 *
 * Ce qu'un creator vient chercher : quel événement rapporte quoi. La
 * règle de commission est donc le seul chiffre mis en avant — le reste
 * (ville, date, organisateur) sert à décider si l'on veut y associer son
 * nom.
 *
 * Les campagnes fermées n'apparaissent pas : elles se rejoignent par le
 * lien que l'organisateur envoie, comme avant. Ouvrir une campagne ne
 * change que sa visibilité.
 */
export default async function CreatorCatalogPage({
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
  const t = await getTranslations("catalog");

  const campaigns = await listOpenCampaigns();

  return (
    <main className="relative flex-1 overflow-hidden">
      <span
        aria-hidden
        className="halo inset-x-0 -top-24 h-[300px] opacity-35"
        style={{ "--halo": "var(--grad-night)" } as React.CSSProperties}
      />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        <h1 className="font-display text-[30px] font-extrabold uppercase">
          {t("title")}
        </h1>
        <p className="mt-2 text-[13px] text-mist">{t("lede")}</p>

        {campaigns.length === 0 ? (
          <div className="sheen mt-8 rounded-sheet bg-surface p-8 text-center">
            <Sticker tone="night" size="lg" className="mx-auto">
              <CampaignIcon size={30} strokeWidth={2.2} />
            </Sticker>
            <p className="mt-5 text-[15px] font-semibold">{t("empty")}</p>
            <p className="mt-2 text-[13px] text-mist">{t("emptyHint")}</p>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <CatalogCard campaign={campaign} locale={activeLocale} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

async function CatalogCard({
  campaign,
  locale,
}: {
  campaign: CatalogCampaign;
  locale: Locale;
}) {
  const t = await getTranslations("catalog");
  const tAff = await getTranslations("affiliation");

  const rule =
    campaign.commissionKind === "percent"
      ? tAff("rulePercent", { value: campaign.commissionValue })
      : tAff("ruleFixed", { value: campaign.commissionValue });

  return (
    <article className="sheen rounded-sheet bg-surface p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
          style={{ background: campaign.event.gradient ?? FALLBACK_GRADIENT }}
        >
          {campaign.event.glyph ?? "🎟"}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/evenements/${campaign.event.slug}`}
            className="font-display block truncate text-[15px] font-extrabold hover:text-brand-bright"
          >
            {campaign.event.title}
          </Link>
          <p className="mt-0.5 truncate text-[12px] text-mist">
            {campaign.organizerName} · {campaign.event.city} ·{" "}
            {formatEventDateShort(campaign.event.starts_at, locale)}
          </p>
        </div>
      </div>

      {/* La règle de commission est ce qui décide : elle prend la ligne
          entière et la couleur de l'argent. */}
      <p className="text-ember font-display mt-4 text-[19px] font-extrabold">
        {rule}
      </p>

      <div className="mt-4">
        {campaign.isMine ? (
          <p className="text-[12.5px] text-mist">{t("ownEvent")}</p>
        ) : campaign.alreadyJoined ? (
          <Link
            href="/creator"
            className="press inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-4 py-2.5 text-[12.5px] font-bold text-success ring-1 ring-inset ring-white/12"
          >
            <DoneIcon size={14} strokeWidth={2.6} aria-hidden />
            {t("joined")}
          </Link>
        ) : (
          <Link
            href={`/creator/rejoindre/${campaign.id}`}
            className="press grad-night font-display inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-[13px] font-extrabold text-white shadow-[0_10px_24px_-12px_rgb(139_92_246/0.9)]"
          >
            {t("join")}
            <NextIcon size={15} strokeWidth={2.6} aria-hidden />
          </Link>
        )}
      </div>
    </article>
  );
}
