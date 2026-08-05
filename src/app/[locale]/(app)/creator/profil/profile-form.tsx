"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveCreatorProfile } from "@/lib/db/creator-profile-actions";
import { initialCreatorProfileState } from "@/lib/db/creator-profile-state";
import type { CreatorProfile } from "@/lib/db/creator-profile";

/**
 * La carte de visite, côté saisie.
 *
 * La bio part dans la langue de l'écran : un creator écrit sa
 * présentation une fois, et lui réclamer deux versions avant qu'il ait
 * un public anglophone serait du zèle. La locale voyage en champ caché
 * plutôt que d'être devinée côté serveur — c'est bien celle dans
 * laquelle il vient d'écrire.
 */
export function CreatorProfileForm({ profile }: { profile: CreatorProfile | null }) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const [state, action, pending] = useActionState(
    saveCreatorProfile,
    initialCreatorProfileState
  );

  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-fog">
          {t("handleLabel")}
        </span>
        <div className="flex items-center gap-2 rounded-2xl bg-ink px-4 ring-1 ring-inset ring-white/10 focus-within:ring-brand">
          <span aria-hidden className="text-[15px] text-smoke">
            @
          </span>
          <input
            name="handle"
            required
            maxLength={24}
            pattern="[a-zA-Z0-9_]{3,24}"
            defaultValue={profile?.handle ?? ""}
            placeholder="mon_pseudo"
            aria-describedby="handle-hint"
            className="flex-1 bg-transparent py-3.5 text-[15px] text-white placeholder:text-smoke focus:outline-none"
          />
        </div>
        <span id="handle-hint" className="text-[12px] text-smoke">
          {t("handleHint")}
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-fog">
          {t("nameLabel")}
        </span>
        <input
          name="displayName"
          required
          minLength={2}
          maxLength={60}
          defaultValue={profile?.displayName ?? ""}
          className="rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-fog">
          {t("cityLabel")}
        </span>
        <input
          name="city"
          maxLength={60}
          defaultValue={profile?.city ?? ""}
          placeholder="Douala"
          className="rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-fog">{t("bioLabel")}</span>
        <textarea
          name="bio"
          rows={4}
          maxLength={400}
          defaultValue={profile?.bio ?? ""}
          placeholder={t("bioPlaceholder")}
          className="rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger ring-1 ring-inset ring-danger/40"
        >
          {state.error}
        </p>
      )}
      {state.notice && (
        <p
          role="status"
          className="rounded-xl bg-success/10 px-4 py-3 text-[13px] text-success ring-1 ring-inset ring-success/40"
        >
          {state.notice}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="press grad-ember glow-brand font-display self-start rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
