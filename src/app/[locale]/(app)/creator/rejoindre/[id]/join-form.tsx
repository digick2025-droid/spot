"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { joinCampaign } from "@/lib/db/affiliation-actions";
import { initialAffiliationFormState } from "@/lib/db/affiliation-state";

export function JoinForm({ campaignId }: { campaignId: string }) {
  const t = useTranslations("affiliation");
  const [state, action, pending] = useActionState(
    joinCampaign,
    initialAffiliationFormState
  );

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="campaignId" value={campaignId} />

      {state.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger ring-1 ring-inset ring-danger/40"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="press grad-ember glow-brand font-display w-full rounded-2xl px-4 py-4 text-[15px] font-extrabold text-white disabled:opacity-60"
      >
        {pending ? t("joining") : t("join")}
      </button>
    </form>
  );
}
