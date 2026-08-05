"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { formatPriceXaf } from "@/lib/format";

/** Les deux opérateurs du tunnel réel, avec leur pastille de marque. */
const OPERATORS = [
  { name: "MTN MoMo", color: "#FFCC00", masked: "6 7• •• •• ••" },
  { name: "Orange Money", color: "#FF7900", masked: "6 9• •• •• ••" },
] as const;

const DEMO_AMOUNT = 5000;

/**
 * Démonstration du paiement, sur la landing : choisir un opérateur, voir
 * la demande partir, puis le billet arriver.
 *
 * C'est une mise en scène — aucun appel réseau, aucune commande créée.
 * Elle raconte la règle qui gouverne le vrai tunnel : le QR n'apparaît
 * qu'après la confirmation de l'opérateur, jamais avant.
 */
export function PaymentDemo() {
  const t = useTranslations("landing.home");
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [operator, setOperator] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Le QR est une illustration : vrais motifs de repère, modules tirés
  // d'une suite déterministe pour que l'image soit stable d'un rendu à
  // l'autre. Il n'encode rien et n'est jamais scanné.
  useEffect(() => {
    if (step !== 2) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const modules = 25;
    const cell = canvas.width / modules;
    let seed = 20260815;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#0B0B0F";

    const inFinder = (x: number, y: number) =>
      (x < 8 && y < 8) ||
      (x > modules - 9 && y < 8) ||
      (x < 8 && y > modules - 9);

    for (let y = 0; y < modules; y++) {
      for (let x = 0; x < modules; x++) {
        if (inFinder(x, y)) continue;
        if (next() > 0.52) context.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    const finder = (ox: number, oy: number) => {
      context.fillRect(ox * cell, oy * cell, 7 * cell, 7 * cell);
      context.clearRect((ox + 1) * cell, (oy + 1) * cell, 5 * cell, 5 * cell);
      context.fillRect((ox + 2) * cell, (oy + 2) * cell, 3 * cell, 3 * cell);
    };
    finder(0, 0);
    finder(modules - 7, 0);
    finder(0, modules - 7);
  }, [step]);

  const pay = (name: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOperator(name);
    setStep(1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStep(2), reduce ? 120 : 2100);
  };

  const replay = () => {
    if (timer.current) clearTimeout(timer.current);
    setStep(0);
    setOperator(null);
  };

  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[30px] border border-white/10 bg-shell px-[1.35rem] py-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)]">
      <div className="mb-[1.15rem] flex items-center justify-between border-b border-white/10 pb-4 text-[10.5px] tabular-nums text-smoke">
        <span>{t("demoBar")}</span>
        <span>21:04</span>
      </div>

      {step === 0 && (
        <div>
          <p className="mb-3.5 text-[0.78rem] text-smoke">{t("demoStepLabel")}</p>
          <p className="font-display mb-0.5 text-[2.05rem] font-extrabold tracking-tight tabular-nums">
            {formatPriceXaf(DEMO_AMOUNT)}
          </p>
          <p className="mb-5 text-[0.8rem] text-mist">{t("demoStepSub")}</p>

          {OPERATORS.map((op) => (
            <button
              key={op.name}
              type="button"
              onClick={() => pay(op.name)}
              className="mb-2 flex w-full items-center gap-2.5 rounded-2xl bg-surface px-[0.95rem] py-3 text-left text-[0.87rem] font-semibold ring-1 ring-inset ring-white/10 transition-transform hover:translate-x-0.5 hover:ring-brand"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: op.color }}
              />
              {op.name}
              <small className="ml-auto text-[0.74rem] font-medium text-smoke">
                {op.masked}
              </small>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="mb-3.5 text-[0.78rem] text-smoke">{t("demoSentLabel")}</p>
          <p className="font-display mb-0.5 text-[2.05rem] font-extrabold tracking-tight tabular-nums">
            {formatPriceXaf(DEMO_AMOUNT)}
          </p>
          <p className="mb-5 text-[0.8rem] text-mist">
            {t("demoSentSub", { operator: operator ?? "" })}
          </p>
          <p className="flex items-center gap-2.5 text-[0.85rem] text-mist">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-brand"
            />
            {t("demoPending")}
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="text-center">
          <canvas
            ref={canvasRef}
            width={300}
            height={300}
            aria-label={t("demoQrAlt")}
            role="img"
            className="mx-auto mb-4 block h-[150px] w-[150px] rounded-xl bg-white p-2.5"
          />
          <p className="font-display text-[1rem] font-extrabold text-brand">
            {t("demoIssued")}
          </p>
          <p className="text-[0.74rem] uppercase tracking-[0.12em] tabular-nums text-smoke">
            {t("demoRef")}
          </p>
          <button
            type="button"
            onClick={replay}
            className="mt-[1.1rem] text-[0.76rem] text-smoke underline underline-offset-[3px] hover:text-brand"
          >
            {t("demoReplay")}
          </button>
        </div>
      )}
    </div>
  );
}
