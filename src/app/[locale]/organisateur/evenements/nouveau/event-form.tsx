"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createEvent } from "@/lib/db/organizer-actions";
import { initialOrganizerFormState } from "@/lib/db/organizer-state";

/** Trois paliers comme dans la maquette ; seul le premier est exigé. */
const TIERS = [
  { index: 0, name: "Standard", price: "5000", quantity: "100" },
  { index: 1, name: "VIP", price: "", quantity: "" },
  { index: 2, name: "", price: "", quantity: "" },
] as const;

const FIELD =
  "rounded-2xl border border-fog bg-paper-card px-4 py-3 text-[15px] text-ink placeholder:text-smoke focus:border-brand focus:outline-none";

const LABEL = "text-[13px] font-semibold text-smoke";

export function EventForm({
  categories,
}: {
  categories: { key: string; label: string }[];
}) {
  const t = useTranslations("organizer");
  const [state, action, pending] = useActionState(
    createEvent,
    initialOrganizerFormState
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("titleLabel")}</span>
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          placeholder={t("titlePlaceholder")}
          className={FIELD}
        />
      </label>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("categoryLabel")}</span>
          <select name="category" defaultValue="" className={FIELD}>
            <option value="">{t("noCategory")}</option>
            {categories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("glyphLabel")}</span>
          <input
            name="glyph"
            maxLength={4}
            defaultValue="🎟"
            className={`${FIELD} text-center text-[20px]`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("descriptionLabel")}</span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          placeholder={t("descriptionPlaceholder")}
          aria-describedby="description-hint"
          className={`${FIELD} resize-y`}
        />
        <span id="description-hint" className="text-[12px] text-smoke">
          {t("descriptionHint")}
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("dateLabel")}</span>
          <input name="date" type="date" required className={FIELD} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("timeLabel")}</span>
          <input
            name="time"
            type="time"
            required
            defaultValue="18:00"
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("cityLabel")}</span>
          <input
            name="city"
            required
            maxLength={60}
            placeholder={t("cityPlaceholder")}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("venueLabel")}</span>
          <input
            name="venue"
            required
            maxLength={120}
            placeholder={t("venuePlaceholder")}
            className={FIELD}
          />
        </label>
      </div>

      <fieldset>
        <legend className="font-display text-[14px] font-extrabold">
          {t("tiersTitle")}
        </legend>
        <p className="mt-1 text-[12px] text-smoke">{t("tiersHint")}</p>

        <div className="mt-3 flex flex-col gap-2.5">
          {TIERS.map((tier) => (
            <div key={tier.index} className="grid grid-cols-3 gap-2.5">
              <input
                name={`tierName${tier.index}`}
                maxLength={40}
                required={tier.index === 0}
                defaultValue={tier.name}
                aria-label={t("tierName")}
                placeholder={t("tierName")}
                className={FIELD}
              />
              <input
                name={`tierPrice${tier.index}`}
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                defaultValue={tier.price}
                aria-label={t("tierPrice")}
                placeholder={t("tierPrice")}
                className={FIELD}
              />
              <input
                name={`tierQuantity${tier.index}`}
                type="number"
                min={1}
                inputMode="numeric"
                defaultValue={tier.quantity}
                aria-label={t("tierQuantity")}
                placeholder={t("tierQuantity")}
                className={FIELD}
              />
            </div>
          ))}
        </div>
      </fieldset>

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
        className="rounded-2xl bg-brand px-4 py-3.5 font-display text-[15px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("publishing") : t("publish")}
      </button>
      <p className="text-center text-[12px] text-smoke">{t("publishHint")}</p>
    </form>
  );
}
