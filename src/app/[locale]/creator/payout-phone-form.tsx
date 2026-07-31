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
          className="rounded-2xl border border-white/10 bg-ink px-4 py-3.5 text-[15px] text-white placeholder:text-smoke focus:border-brand focus:outline-none"
        />
        <span id="payout-phone-hint" className="text-[12px] text-smoke">
          {t("payoutPhoneHint")}
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
        className="self-start rounded-2xl bg-brand px-5 py-3 font-display text-[14px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("savingPhone") : t("savePhone")}
      </button>
    </form>
  );
}
