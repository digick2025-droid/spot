"use client";

import { useActionState } from "react";
import {
  initialOrganizerFormState,
  type OrganizerFormState,
} from "@/lib/db/organizer-state";

/**
 * Confirmation native avant l'envoi : une suppression n'a pas de retour
 * en arrière, contrairement au reste du formulaire.
 */
export function DeleteEventButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
}: {
  action: (
    state: OrganizerFormState,
    formData: FormData
  ) => Promise<OrganizerFormState>;
  label: string;
  pendingLabel: string;
  confirmMessage: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialOrganizerFormState
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl border border-danger/40 px-4 py-3.5 font-display text-[15px] font-extrabold text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        {pending ? pendingLabel : label}
      </button>
      {state.error && (
        <p role="alert" className="mt-2 text-center text-[13px] text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
