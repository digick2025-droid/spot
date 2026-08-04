import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  Band,
  Card,
  Eyebrow,
  Perforation,
  Steps,
  Ticket,
  Wrap,
  ctaClassName,
} from "@/components/site/ui";
import { formatPriceXaf } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.organizers" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function LandingOrganizersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const t = await getTranslations("landing.organizers");

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
    { title: t("step4Title"), body: t("step4Body") },
  ];

  const costs = [
    { label: t("cost1Num"), title: t("cost1Title"), body: t("cost1Body") },
    { label: t("cost2Num"), title: t("cost2Title"), body: t("cost2Body") },
    { label: t("cost3Num"), title: t("cost3Title"), body: t("cost3Body") },
  ];

  const board = [
    { label: t("board1Num"), title: t("board1Title"), body: t("board1Body") },
    { label: t("board2Num"), title: t("board2Title"), body: t("board2Body") },
    { label: t("board3Num"), title: t("board3Title"), body: t("board3Body") },
    { label: t("board4Num"), title: t("board4Title"), body: t("board4Body") },
  ];

  return (
    <>
      {/* ── Héros, sur le thème clair de l'espace Organisateur ───── */}
      <Band className="bg-paper text-ink">
        <Wrap className="grid items-center gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1 className="font-display mb-[1.2rem] text-[clamp(2.2rem,5.6vw,3.9rem)] font-extrabold leading-none tracking-[-0.045em]">
              {t("titleA")}
              <br />
              {t("titleB")}
            </h1>
            <p className="max-w-[62ch] text-[clamp(1rem,1.45vw,1.18rem)] leading-relaxed text-zinc-600">
              {t("lede")}
            </p>
            <div className="mt-[1.9rem] flex flex-wrap gap-2.5">
              <Link href="/organisateur" className={ctaClassName("brand")}>
                {t("ctaSpace")}
              </Link>
              <Link href="/creators" className={ctaClassName("ghostLight")}>
                {t("ctaCreators")}
              </Link>
            </div>
          </div>

          <Ticket
            variant="light"
            stub={
              <div className="grid grid-cols-2 gap-[1.1rem]">
                <div>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-[0.13em] text-zinc-500">
                    {t("boardSoldLabel")}
                  </span>
                  <span className="font-display text-[1.35rem] font-extrabold tracking-tight tabular-nums">
                    318 / 500
                  </span>
                </div>
                <div>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-[0.13em] text-zinc-500">
                    {t("boardRevenueLabel")}
                  </span>
                  <span className="font-display text-[1.35rem] font-extrabold tracking-tight tabular-nums text-brand-deep">
                    {formatPriceXaf(1590000)}
                  </span>
                </div>
              </div>
            }
          >
            <span aria-hidden className="mb-3.5 block text-[2rem] leading-none">
              📊
            </span>
            <p className="font-display mb-1 text-[1.45rem] font-extrabold tracking-tight">
              {t("boardTitle")}
            </p>
            <p className="text-[0.83rem] text-zinc-500">{t("boardMeta")}</p>
          </Ticket>
        </Wrap>
      </Band>

      {/* ── Quatre étapes ────────────────────────────────────────── */}
      <Band tight>
        <Wrap>
          <Eyebrow>{t("stepsEyebrow")}</Eyebrow>
          <h2 className="font-display max-w-[20ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
            {t("stepsTitle")}
          </h2>
          <div className="reveal">
            <Steps items={steps} />
          </div>
        </Wrap>
      </Band>

      <Perforation />

      {/* ── Ce que ça coûte ──────────────────────────────────────── */}
      <Band tight>
        <Wrap>
          <Eyebrow>{t("costEyebrow")}</Eyebrow>
          <h2 className="font-display max-w-[22ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
            {t("costTitle")}
          </h2>
          <div className="reveal mt-[2.2rem] grid gap-4 md:grid-cols-3">
            {costs.map((cost) => (
              <Card key={cost.label} label={cost.label} title={cost.title}>
                {cost.body}
              </Card>
            ))}
          </div>
          <p className="mt-5 text-[0.82rem] text-smoke">{t("costNote")}</p>
        </Wrap>
      </Band>

      <Perforation />

      {/* ── Le tableau de bord ───────────────────────────────────── */}
      <Band tight>
        <Wrap>
          <Eyebrow>{t("boardEyebrow")}</Eyebrow>
          <h2 className="font-display max-w-[20ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
            {t("boardHeadline")}
          </h2>
          <div className="reveal mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {board.map((item) => (
              <Card key={item.label} label={item.label} title={item.title}>
                {item.body}
              </Card>
            ))}
          </div>
          <div className="mt-[1.9rem] flex flex-wrap gap-2.5">
            <Link href="/organisateur" className={ctaClassName("brand")}>
              {t("ctaFinal")}
            </Link>
          </div>
        </Wrap>
      </Band>
    </>
  );
}
