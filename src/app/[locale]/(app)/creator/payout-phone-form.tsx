"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updatePayoutPhone } from "@/lib/db/payout-actions";
import { initialPayoutState } from "@/lib/db/payout-state";

/**
 * Numéro sur lequel le creator veut recevoir ses commissions.
 *
 * Tant qu'il est vide, l'organisateur ne peut rien envoyer : les
 * commissions restent dues, elles ne se perdent pas.
 */
export function PayoutPhoneForm({ phone }: { phone: string }) {
  const t = useTranslations("affiliation");
  const [state, action, pending] = useActionState(
    updatePayoutPhone,
    initialPayoutState
  );

  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-fog">
          {t("payoutPhoneLabel")}
        </span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          defaultValue={phone}
          placeholder="+237 6 71 23 45 67"
          aria-describedby="payout-phone-hint"
          className="rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
        />
        <span id="payout-phone-hint" className="text-[12px] text-smoke">
          {t("payoutPhoneHint")}
        </span>
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
        {pending ? t("savingPhone") : t("savePhone")}
      </button>
    </form>
  );
}
