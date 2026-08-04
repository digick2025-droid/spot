"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { formatPriceXaf } from "@/lib/format";
import { Eyebrow } from "./ui";

/**
 * Simulateur de commission creator.
 *
 * Trois curseurs, une multiplication : prix × places × taux. Rien n'est
 * envoyé nulle part — le taux réel est celui de la campagne rejointe, ce
 * que la note sous le résultat dit explicitement.
 */
export function CommissionCalculator() {
  const t = useTranslations("landing.creators");
  const ids = useId();

  const [price, setPrice] = useState(5000);
  const [seats, setSeats] = useState(40);
  const [rate, setRate] = useState(10);

  const total = Math.round((price * seats * rate) / 100);

  const rows = [
    {
      id: `${ids}-price`,
      label: t("calcPrice"),
      value: formatPriceXaf(price),
      min: 1000,
      max: 25000,
      step: 500,
      current: price,
      onChange: setPrice,
    },
    {
      id: `${ids}-seats`,
      label: t("calcSeats"),
      value: seats.toLocaleString("fr-FR"),
      min: 5,
      max: 300,
      step: 5,
      current: seats,
      onChange: setSeats,
    },
    {
      id: `${ids}-rate`,
      label: t("calcRate"),
      value: `${rate} %`,
      min: 1,
      max: 30,
      step: 1,
      current: rate,
      onChange: setRate,
    },
  ];

  return (
    <div className="rounded-[22px] border border-accent/40 bg-gradient-to-b from-accent/10 to-card p-[clamp(1.4rem,3vw,2rem)]">
      <Eyebrow tone="accent" className="mb-5">
        {t("calcEyebrow")}
      </Eyebrow>

      {rows.map((row) => (
        <div key={row.id}>
          <div className="mb-1 flex items-center justify-between gap-4">
            <label
              htmlFor={row.id}
              className="text-[0.83rem] font-semibold text-mist"
            >
              {row.label}
            </label>
            <span className="font-display text-[0.95rem] font-extrabold tabular-nums">
              {row.value}
            </span>
          </div>
          <input
            id={row.id}
            type="range"
            min={row.min}
            max={row.max}
            step={row.step}
            value={row.current}
            onChange={(event) => row.onChange(Number(event.target.value))}
            className="mb-[1.35rem] h-[22px] w-full accent-accent"
          />
        </div>
      ))}

      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-4 border-t border-dashed border-white/20 pt-5">
        <div>
          <span className="block text-[10.5px] font-semibold uppercase tracking-[0.13em] text-smoke">
            {t("calcOut")}
          </span>
          <output
            className="font-display block text-[clamp(2rem,5vw,2.9rem)] font-extrabold leading-none tracking-tight tabular-nums text-accent"
            aria-live="polite"
          >
            {formatPriceXaf(total)}
          </output>
        </div>
        <p className="m-0 max-w-[34ch] text-[0.8rem] text-smoke">
          {t("calcNote")}
        </p>
      </div>
    </div>
  );
}
