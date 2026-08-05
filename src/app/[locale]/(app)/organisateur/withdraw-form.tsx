"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { PayoutPhoneForm } from "@/components/payout-phone-form";
import { requestOrganizerWithdrawal } from "@/lib/db/withdrawal-actions";
import { initialWithdrawalState } from "@/lib/db/withdrawal-state";
import { formatPriceXaf } from "@/lib/format";

/**
 * Bouton « Retirer » du tableau de bord.
 *
 * Le montant affiché vient du serveur, mais il n'est pas ce qui sera
 * inscrit : la fonction en base recalcule le solde sous verrou. Deux
 * onglets qui cliquent ensemble donnent une seule demande — le second
 * reçoit « déjà demandé ».
 *
 * Trois états, et un seul bouton cliquable : sans numéro de versement il
 * n'y a rien à faire ici mais un profil à compléter, et une demande déjà
 * ouverte se rappelle au lieu de s'ajouter.
 */
export function WithdrawForm({
  organizerId,
  availableXaf,
  hasPayoutPhone,
  hasOpenRequest,
}: {
  organizerId: string;
  availableXaf: number;
  hasPayoutPhone: boolean;
  hasOpenRequest: boolean;
}) {
  const t = useTranslations("money");
  const [state, action, pending] = useActionState(
    requestOrganizerWithdrawal,
    initialWithdrawalState
  );

  // Le champ plutôt qu'un lien vers ailleurs : il manque une seule
  // chose pour retirer, autant la demander ici.
  if (!hasPayoutPhone) {
    return (
      <div className="w-full sm:max-w-sm">
        <p className="text-[12.5px] text-smoke">{t("noPayoutPhoneOrganizer")}</p>
        <PayoutPhoneForm phone="" tone="paper" />
      </div>
    );
  }

  if (hasOpenRequest) {
    return <p className="text-[12.5px] text-smoke">{t("requestPending")}</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="organizerId" value={organizerId} />

      <button
        type="submit"
        disabled={pending || availableXaf <= 0}
        className="press grad-heat font-display rounded-full px-5 py-3 text-[13px] font-extrabold text-white shadow-[0_10px_24px_-12px_rgb(194_65_12/0.9)] disabled:opacity-50"
      >
        {pending
          ? t("requesting")
          : t("withdraw", { amount: formatPriceXaf(availableXaf) })}
      </button>

      {availableXaf <= 0 && !pending && (
        <p className="mt-2 text-[12px] text-smoke">{t("nothingToWithdrawHint")}</p>
      )}
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
