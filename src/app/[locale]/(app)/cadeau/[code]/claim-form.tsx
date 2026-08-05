"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { GiftIcon, LoadingIcon } from "@/components/icons";
import { claimGiftAction } from "@/lib/db/gift-actions";
import { initialGiftState } from "@/lib/db/gift-state";

/** Le bouton qui fait passer le billet au nom de celui qui l'ouvre. */
export function ClaimForm({ code }: { code: string }) {
  const t = useTranslations("gift");
  const [state, action, pending] = useActionState(
    claimGiftAction,
    initialGiftState
  );

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="code" value={code} />

      {state.error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-center text-[13px] text-danger ring-1 ring-inset ring-danger/40"
        >
          {t(`errors.${state.error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="press grad-ember glow-brand font-display flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-extrabold text-white disabled:opacity-60"
      >
        {pending ? (
          <LoadingIcon
            size={17}
            strokeWidth={2.6}
            className="animate-spin"
            aria-hidden
          />
        ) : (
          <GiftIcon size={17} strokeWidth={2.4} aria-hidden />
        )}
        {pending ? t("claiming") : t("claimCta")}
      </button>
    </form>
  );
}
