"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { payCreator } from "@/lib/db/payout-actions";
import { initialPayoutState } from "@/lib/db/payout-state";
import { formatPriceXaf } from "@/lib/format";

/**
 * Bouton « Verser » d'une ligne creator.
 *
 * Le montant affiché vient du serveur, mais il n'est pas ce qui sera
 * payé : payCreator recalcule le dû sous verrou. Si deux onglets
 * cliquent en même temps, le second reçoit « rien à verser » plutôt
 * qu'un second virement.
 */
export function PayCreatorForm({
  campaignId,
  creatorId,
  dueXaf,
  hasPayoutPhone,
}: {
  campaignId: string;
  creatorId: string;
  dueXaf: number;
  hasPayoutPhone: boolean;
}) {
  const t = useTranslations("affiliation");
  const [state, action, pending] = useActionState(payCreator, initialPayoutState);

  if (!hasPayoutPhone) {
    return <p className="text-[12px] text-smoke">{t("noPayoutPhone")}</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="creatorId" value={creatorId} />

      <button
        type="submit"
        disabled={pending}
        className="press grad-night font-display rounded-full px-4 py-2.5 text-[12px] font-extrabold text-white shadow-[0_8px_20px_-10px_rgb(139_92_246/0.9)] disabled:opacity-60"
      >
        {pending
          ? t("paying")
          : t("pay", { amount: formatPriceXaf(dueXaf) })}
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
