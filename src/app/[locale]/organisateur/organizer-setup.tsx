"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createOrganizer } from "@/lib/db/organizer-actions";
import { initialOrganizerFormState } from "@/lib/db/organizer-state";

/** Création de la fiche organisateur, préalable à tout événement. */
export function OrganizerSetup({ defaultName }: { defaultName: string }) {
  const t = useTranslations("organizer");
  const [state, action, pending] = useActionState(
    createOrganizer,
    initialOrganizerFormState
  );

  return (
    <form action={action} className="mt-6 flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-smoke">
          {t("nameLabel")}
        </span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={defaultName}
          placeholder={t("namePlaceholder")}
          className="rounded-2xl border border-fog bg-paper-card px-4 py-3.5 text-[15px] text-ink placeholder:text-smoke focus:border-brand focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-smoke">
          {t("glyphLabel")}
        </span>
        <input
          name="glyph"
          maxLength={4}
          defaultValue="🎪"
          aria-describedby="glyph-hint"
          className="w-24 rounded-2xl border border-fog bg-paper-card px-4 py-3.5 text-center text-[20px] focus:border-brand focus:outline-none"
        />
        <span id="glyph-hint" className="text-[12px] text-smoke">
          {t("glyphHint")}
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
        className="rounded-2xl bg-brand px-4 py-3.5 font-display text-[15px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("creating") : t("createOrganizer")}
      </button>
    </form>
  );
}
