"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DoneIcon,
  GiftIcon,
  LoadingIcon,
  MobileMoneyIcon,
} from "@/components/icons";
import { startPayment } from "@/lib/payments/actions";
import { initialCheckoutState } from "@/lib/payments/state";

/**
 * Les deux opérateurs gardent leur couleur : sur ce marché, on ne choisit
 * pas « un moyen de paiement », on choisit MTN ou Orange — la couleur est
 * le nom. Elle n'apparaît que sur la pastille, jamais en fond de bouton,
 * pour que le jaune MTN ne devienne pas la couleur d'action de l'écran.
 */
const CHANNELS = [
  { value: "mtn_momo", labelKey: "mtn", accent: "#FFCC00", ink: "#1A1400" },
  { value: "orange_money", labelKey: "orange", accent: "#FF6600", ink: "#1A0A00" },
] as const;

export function CheckoutForm({
  eventSlug,
  ticketTypeId,
  quantity,
  totalLabel,
  defaultPhone,
  isGift = false,
}: {
  eventSlug: string;
  ticketTypeId: string;
  quantity: number;
  totalLabel: string;
  defaultPhone: string;
  /** Vient du sélecteur de billets : on paie pour quelqu'un d'autre. */
  isGift?: boolean;
}) {
  const t = useTranslations("checkout");
  const tGift = useTranslations("gift");
  const [state, action, pending] = useActionState(
    startPayment,
    initialCheckoutState
  );
  const [channel, setChannel] = useState<string>(CHANNELS[0].value);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <input type="hidden" name="ticketTypeId" value={ticketTypeId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="channel" value={channel} />
      {isGift && <input type="hidden" name="gift" value="1" />}

      {/* Pour qui, et le mot qui va avec. Les deux champs ne partent que
          si l'on est venu par « Offrir » : ailleurs, ils n'existent pas
          dans le formulaire, et le serveur ignore leur contenu. */}
      {isGift && (
        <fieldset className="sheen rounded-card bg-surface p-4">
          <legend className="font-display flex items-center gap-1.5 px-1 text-[13px] font-extrabold">
            <GiftIcon size={15} strokeWidth={2.4} aria-hidden />
            {tGift("recipientLabel")}
          </legend>

          <input
            name="giftRecipientName"
            required
            minLength={2}
            maxLength={80}
            autoComplete="off"
            placeholder={tGift("recipientPlaceholder")}
            className="mt-3 w-full rounded-2xl bg-ink px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
          />

          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-mist">
              {tGift("messageLabel")}
            </span>
            <textarea
              name="giftMessage"
              rows={2}
              maxLength={280}
              placeholder={tGift("messagePlaceholder")}
              className="mt-1.5 w-full resize-y rounded-2xl bg-ink px-4 py-3 text-[14px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
            />
          </label>

          <p className="mt-2 px-1 text-[12px] leading-relaxed text-smoke">
            {tGift("pickerHint")}
          </p>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-[13px] font-semibold text-fog">
          {t("payWith")}
        </legend>
        <div className="mt-2.5 flex flex-col gap-2.5">
          {CHANNELS.map((c) => {
            const active = channel === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                aria-pressed={active}
                className={`press flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-3.5 text-left ring-1 ring-inset transition-colors ${
                  active
                    ? "bg-surface-high ring-brand"
                    : "ring-white/10 hover:ring-white/25"
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: c.accent, color: c.ink }}
                >
                  <MobileMoneyIcon size={19} strokeWidth={2.4} />
                </span>
                <span className="flex-1 text-[14px] font-semibold">
                  {t(c.labelKey)}
                </span>
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-brand text-white" : "ring-2 ring-inset ring-white/25"
                  }`}
                >
                  {active && <DoneIcon size={13} strokeWidth={3.5} />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-fog">
          {t("phoneLabel")}
        </span>
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          defaultValue={defaultPhone}
          placeholder="+237 6 71 23 45 67"
          aria-describedby="phone-hint"
          className="rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
        />
        <span id="phone-hint" className="text-[12px] text-smoke">
          {t("phoneHint")}
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

      <button
        type="submit"
        disabled={pending}
        className="press grad-ember glow-brand font-display flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-extrabold text-white disabled:opacity-60"
      >
        {pending && (
          <LoadingIcon
            size={17}
            strokeWidth={2.6}
            className="animate-spin"
            aria-hidden
          />
        )}
        {pending ? t("paying") : t("pay", { total: totalLabel })}
      </button>
    </form>
  );
}
