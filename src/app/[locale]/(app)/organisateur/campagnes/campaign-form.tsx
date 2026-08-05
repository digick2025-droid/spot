"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createCampaign } from "@/lib/db/affiliation-actions";
import { initialAffiliationFormState } from "@/lib/db/affiliation-state";

const FIELD =
  "rounded-2xl border border-paper-line bg-paper-card px-4 py-3 text-[15px] text-ink shadow-[0_1px_2px_rgb(16_16_24/0.04)] placeholder:text-smoke focus:border-brand focus:outline-none";

const LABEL = "text-[13px] font-semibold text-smoke";

/**
 * Ouverture d'une campagne.
 *
 * Le type de commission pilote l'unité affichée à côté de la valeur :
 * un pourcentage se borne à 100, un montant fixe se compte en FCFA par
 * billet. La base porte les mêmes règles (campaigns_percent_max) — ici
 * c'est du confort de saisie, pas la garantie.
 */
export function CampaignForm({
  events,
}: {
  events: { id: string; title: string; glyph: string | null }[];
}) {
  const t = useTranslations("affiliation");
  const [state, action, pending] = useActionState(
    createCampaign,
    initialAffiliationFormState
  );
  const [kind, setKind] = useState<"percent" | "fixed">("fixed");

  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("eventLabel")}</span>
        <select name="eventId" required defaultValue="" className={FIELD}>
          <option value="" disabled>
            —
          </option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.glyph ?? "🎟"} {event.title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("nameLabel")}</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={t("namePlaceholder")}
          className={FIELD}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("kindLabel")}</span>
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as "percent" | "fixed")}
            className={FIELD}
          >
            <option value="fixed">{t("kindFixed")}</option>
            <option value="percent">{t("kindPercent")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("valueLabel")}</span>
          <input
            name="value"
            type="number"
            required
            min={1}
            max={kind === "percent" ? 100 : 1_000_000}
            step={kind === "percent" ? 1 : 100}
            inputMode="numeric"
            defaultValue={kind === "percent" ? 10 : 500}
            key={kind}
            className={FIELD}
          />
        </label>
      </div>

      {/* Ouvrir ne donne aucun droit d'écriture : cela rend seulement la
          campagne visible dans le catalogue des creators. Fermée par
          défaut — c'est l'organisateur qui décide qui porte son nom. */}
      <label className="flex items-start gap-3 rounded-2xl border border-paper-line bg-paper-card p-4">
        <input
          type="checkbox"
          name="open"
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
        />
        <span>
          <span className="block text-[14px] font-bold">{t("openLabel")}</span>
          <span className="mt-1 block text-[12px] text-smoke">
            {t("openHint")}
          </span>
        </span>
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-[13px] text-danger"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="press grad-ember glow-brand font-display rounded-2xl px-4 py-3.5 text-[15px] font-extrabold text-white disabled:opacity-60"
      >
        {pending ? t("creating") : t("create")}
      </button>
    </form>
  );
}
