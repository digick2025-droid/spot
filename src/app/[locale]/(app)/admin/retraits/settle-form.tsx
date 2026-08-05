"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { settleWithdrawal } from "@/lib/db/admin-withdrawal-actions";
import { initialWithdrawalState } from "@/lib/db/withdrawal-state";

/**
 * Les deux issues d'une demande.
 *
 * Un seul état de formulaire pour les deux boutons : ils s'excluent, et
 * le message de retour est le même endroit quelle que soit l'issue.
 *
 * « Versé » ne verse rien : il enregistre que l'argent est parti. Le
 * libellé le dit — « Marquer versé », pas « Verser ».
 */
export function SettleForm({ withdrawalId }: { withdrawalId: string }) {
  const t = useTranslations("money");
  const [state, action, pending] = useActionState(
    settleWithdrawal,
    initialWithdrawalState
  );

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="withdrawalId" value={withdrawalId} />

      <button
        type="submit"
        name="status"
        value="paid"
        disabled={pending}
        className="press font-display rounded-full bg-success px-4 py-2 text-[12px] font-extrabold text-white disabled:opacity-60"
      >
        {t("markPaid")}
      </button>
      <button
        type="submit"
        name="status"
        value="rejected"
        disabled={pending}
        className="press font-display rounded-full border border-paper-line bg-paper-card px-4 py-2 text-[12px] font-extrabold text-danger disabled:opacity-60"
      >
        {t("markRejected")}
      </button>

      {state.error && (
        <span role="alert" className="text-[12px] text-danger">
          {state.error}
        </span>
      )}
      {state.notice && (
        <span role="status" className="text-[12px] text-success">
          {state.notice}
        </span>
      )}
    </form>
  );
}
