"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { startPayment, initialCheckoutState } from "@/lib/payments/actions";

const CHANNELS = [
  { value: "mtn_momo", labelKey: "mtn", emoji: "📱", accent: "#FFCC00" },
  { value: "orange_money", labelKey: "orange", emoji: "🟠", accent: "#FF6600" },
] as const;

export function CheckoutForm({
  eventSlug,
  ticketTypeId,
  quantity,
  totalLabel,
  defaultPhone,
}: {
  eventSlug: string;
  ticketTypeId: string;
  quantity: number;
  totalLabel: string;
  defaultPhone: string;
}) {
  const t = useTranslations("checkout");
  const [state, action, pending] = useActionState(startPayment, initialCheckoutState);
  const [channel, setChannel] = useState<string>(CHANNELS[0].value);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="eventSlug" value={eventSlug} />
      <input type="hidden" name="ticketTypeId" value={ticketTypeId} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="channel" value={channel} />

      <fieldset>
        <legend className="text-[13px] font-semibold text-fog">
          {t("payWith")}
        </legend>
        <div className="mt-2 flex flex-col gap-2">
          {CHANNELS.map((c) => {
            const active = channel === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setChannel(c.value)}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  active
                    ? "border-brand bg-brand/10"
                    : "border-white/10 bg-card hover:border-brand/40"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    active ? "border-brand bg-brand" : "border-white/30"
                  }`}
                />
                <span aria-hidden className="text-xl">
                  {c.emoji}
                </span>
                <span className="text-[14px] font-semibold">{t(c.labelKey)}</span>
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
          className="rounded-2xl border border-white/10 bg-card px-4 py-3.5 text-[15px] text-white placeholder:text-smoke focus:border-brand focus:outline-none"
        />
        <span id="phone-hint" className="text-[12px] text-smoke">
          {t("phoneHint")}
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-brand px-4 py-3.5 font-display text-[15px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("paying") : t("pay", { total: totalLabel })}
      </button>
    </form>
  );
}
