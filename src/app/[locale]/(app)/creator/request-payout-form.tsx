"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestCreatorWithdrawal } from "@/lib/db/withdrawal-actions";
import { initialWithdrawalState } from "@/lib/db/withdrawal-state";
import { formatPriceXaf } from "@/lib/format";

/**
 * « Demander mon versement », sur une campagne.
 *
 * Le creator ne reçoit pas d'argent de SPOT : c'est l'organisateur qui
 * ordonne le paiement de ce qu'il doit. Le bouton n'est donc pas un
 * retrait mais un signal — d'où le libellé, qui promet une demande et
 * pas un virement.
 *
 * La demande se ferme d'elle-même quand l'organisateur verse.
 */
export function RequestPayoutForm({
  campaignId,
  dueXaf,
  hasPayoutPhone,
  alreadyRequested,
}: {
  campaignId: string;
  dueXaf: number;
  hasPayoutPhone: boolean;
  alreadyRequested: boolean;
}) {
  const t = useTranslations("money");
  const [state, action, pending] = useActionState(
    requestCreatorWithdrawal,
    initialWithdrawalState
  );

  if (dueXaf <= 0) return null;

  if (!hasPayoutPhone) {
    return <p className="mt-4 text-[12px] text-smoke">{t("noPayoutPhoneCreator")}</p>;
  }

  if (alreadyRequested) {
    return <p className="mt-4 text-[12px] text-warning">{t("payoutRequestPending")}</p>;
  }

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="campaignId" value={campaignId} />

      <button
        type="submit"
        disabled={pending}
        className="press font-display rounded-full bg-white/[0.08] px-4 py-2.5 text-[12.5px] font-extrabold ring-1 ring-inset ring-white/15 hover:text-brand-bright disabled:opacity-60"
      >
        {pending
          ? t("requesting")
          : t("requestPayout", { amount: formatPriceXaf(dueXaf) })}
      </button>

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] text-danger">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="mt-2 text-[12px] text-success">
          {state.notice}
        </p>
      )}
    </form>
  );
}
