import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import {
  Band,
  Eyebrow,
  Perforation,
  Steps,
  Wrap,
  ctaClassName,
} from "@/components/site/ui";
import { CommissionCalculator } from "@/components/site/commission-calculator";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.creators" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function LandingCreatorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const t = await getTranslations("landing.creators");

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
    { title: t("step4Title"), body: t("step4Body") },
  ];

  return (
    <>
      {/* ── Héros et simulateur ──────────────────────────────────── */}
      <Band className="overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 left-1/2 h-[420px] w-[min(760px,110vw)] -translate-x-1/2 blur-lg"
          style={{
            background:
              "radial-gradient(60% 70% at 50% 100%, rgba(139,92,246,0.26), transparent 72%)",
          }}
        />
        <Wrap className="relative grid items-center gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Eyebrow tone="accent">{t("eyebrow")}</Eyebrow>
            <h1 className="font-display mb-[1.2rem] text-[clamp(2.2rem,5.6vw,3.9rem)] font-extrabold leading-none tracking-[-0.045em]">
              {t("title")}
            </h1>
            <p className="max-w-[62ch] text-[clamp(1rem,1.45vw,1.18rem)] leading-relaxed text-mist">
              {t("lede")}
            </p>
            <div className="mt-[1.9rem] flex flex-wrap gap-2.5">
              <Link href="/creator" className={ctaClassName("accent")}>
                {t("ctaJoin")}
              </Link>
              <Link href="/organisateurs" className={ctaClassName("ghost")}>
                {t("ctaOrganizer")}
              </Link>
            </div>
          </div>

          <CommissionCalculator />
        </Wrap>
      </Band>

      <Perforation />

      {/* ── Quatre étapes ────────────────────────────────────────── */}
      <Band tight>
        <Wrap>
          <Eyebrow tone="accent">{t("stepsEyebrow")}</Eyebrow>
          <h2 className="font-display max-w-[20ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
            {t("stepsTitle")}
          </h2>
          <div className="reveal">
            <Steps items={steps} tone="accent" />
          </div>
        </Wrap>
      </Band>

      <Perforation />

      {/* ── La règle qui protège le creator ──────────────────────── */}
      <Band tight>
        <Wrap>
          <Eyebrow tone="accent">{t("ruleEyebrow")}</Eyebrow>
          <h2 className="font-display max-w-[24ch] text-[clamp(1.8rem,3.7vw,2.75rem)] font-extrabold leading-[1.07] tracking-[-0.035em]">
            {t("ruleTitle")}
          </h2>

          <div className="reveal mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[20px] border border-accent/45 bg-gradient-to-b from-accent/10 to-card p-[1.6rem]">
              <h3 className="font-display text-[1.0625rem] font-extrabold tracking-tight text-accent">
                {t("rule1Title")}
              </h3>
              <p className="mt-2 text-[0.93rem] text-mist">{t("rule1Body")}</p>
            </div>

            <div className="sheen rounded-sheet bg-surface p-[1.6rem]">
              <h3 className="font-display text-[1.0625rem] font-extrabold tracking-tight text-brand-bright">
                {t("rule2Title")}
              </h3>
              <p className="mt-2 text-[0.93rem] text-mist">{t("rule2Body")}</p>
              <p className="mt-4 text-[0.83rem] text-smoke">{t("rule2Note")}</p>
            </div>
          </div>

          <div className="mt-[1.9rem] flex flex-wrap gap-2.5">
            <Link href="/creator" className={ctaClassName("accent")}>
              {t("ctaFinal")}
            </Link>
          </div>
        </Wrap>
      </Band>
    </>
  );
}
