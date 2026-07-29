"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/auth/profile-actions";
import { initialProfileState } from "@/lib/auth/profile-state";

const FIELD =
  "rounded-2xl border border-white/10 bg-card px-4 py-3.5 text-[15px] text-white placeholder:text-smoke focus:border-brand focus:outline-none";

const LABEL = "text-[13px] font-semibold text-fog";

export function ProfileForm({
  fullName,
  phone,
  locale,
}: {
  fullName: string;
  phone: string;
  locale: string;
}) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(
    updateProfile,
    initialProfileState
  );

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("nameLabel")}</span>
        <input
          name="fullName"
          maxLength={80}
          autoComplete="name"
          defaultValue={fullName}
          placeholder={t("namePlaceholder")}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("phoneLabel")}</span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          defaultValue={phone}
          placeholder="+237 6 71 23 45 67"
          aria-describedby="account-phone-hint"
          className={FIELD}
        />
        <span id="account-phone-hint" className="text-[12px] text-smoke">
          {t("phoneHint")}
        </span>
      </label>

      <fieldset>
        <legend className={LABEL}>{t("localeLabel")}</legend>
        <div className="mt-2 flex gap-2">
          {(["fr", "en"] as const).map((value) => (
            <label
              key={value}
              className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/10 bg-card px-4 py-3 text-[14px] font-semibold has-checked:border-brand has-checked:bg-brand/10"
            >
              <input
                type="radio"
                name="locale"
                value={value}
                defaultChecked={locale === value}
                className="accent-brand"
              />
              {t(value === "fr" ? "localeFr" : "localeEn")}
            </label>
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

      {state.notice && (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-[13px] text-success"
        >
          {state.notice}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-brand px-4 py-3.5 font-display text-[15px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
