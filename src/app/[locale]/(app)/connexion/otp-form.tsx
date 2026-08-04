"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { submitAuth } from "@/lib/auth/actions";
import { initialAuthState } from "@/lib/auth/state";

export function OtpForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(submitAuth, initialAuthState);
  const onCodeStep = state.step === "code";

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {/* Conserve l'adresse entre les deux étapes */}
      {onCodeStep && <input type="hidden" name="email" value={state.email} />}

      {onCodeStep ? (
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-fog">
            {t("codeLabel")}
          </span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            placeholder={t("codePlaceholder")}
            aria-describedby={state.error ? "auth-error" : undefined}
            className="rounded-2xl border border-white/10 bg-card px-4 py-3.5 text-center font-display text-2xl font-extrabold tracking-[0.4em] text-white placeholder:tracking-[0.3em] placeholder:text-smoke focus:border-brand focus:outline-none"
          />
        </label>
      ) : (
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-fog">
            {t("emailLabel")}
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            defaultValue={state.email}
            placeholder={t("emailPlaceholder")}
            aria-describedby={state.error ? "auth-error" : undefined}
            className="rounded-2xl border border-white/10 bg-card px-4 py-3.5 text-[15px] text-white placeholder:text-smoke focus:border-brand focus:outline-none"
          />
        </label>
      )}

      {state.error && (
        <p
          id="auth-error"
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-[13px] text-danger"
        >
          {state.error}
        </p>
      )}

      {state.notice && !state.error && (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-[13px] text-success"
        >
          {state.notice}
        </p>
      )}

      <button
        type="submit"
        name="intent"
        value={onCodeStep ? "verify" : "request"}
        disabled={pending}
        className="rounded-2xl bg-brand px-4 py-3.5 font-display text-[15px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending
          ? onCodeStep
            ? t("verifying")
            : t("sending")
          : onCodeStep
            ? t("verify")
            : t("sendCode")}
      </button>

      {onCodeStep && (
        <div className="flex items-center justify-between text-[13px]">
          <button
            type="submit"
            name="intent"
            value="resend"
            disabled={pending}
            className="font-semibold text-brand hover:underline disabled:opacity-50"
          >
            {t("resend")}
          </button>
          <button
            type="submit"
            name="intent"
            value="reset"
            disabled={pending}
            className="text-mist hover:underline disabled:opacity-50"
          >
            {t("changeEmail")}
          </button>
        </div>
      )}
    </form>
  );
}
