"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  MAX_TICKETS_PER_ORDER,
  MIN_TICKETS_PER_ORDER,
  formatPriceXaf,
} from "@/lib/format";

export type TicketOption = {
  id: string;
  name: string;
  priceXaf: number;
  priceLabel: string;
  remaining: number;
};

export function TicketPicker({
  eventSlug,
  ticketTypes,
  isSignedIn,
}: {
  eventSlug: string;
  ticketTypes: TicketOption[];
  isSignedIn: boolean;
}) {
  const t = useTranslations("events");
  const available = ticketTypes.filter((tt) => tt.remaining > 0);
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "");
  const [quantity, setQuantity] = useState(MIN_TICKETS_PER_ORDER);

  const selected = ticketTypes.find((tt) => tt.id === selectedId);
  // Ne jamais proposer plus de billets qu'il n'en reste réellement.
  const maxQuantity = Math.min(
    MAX_TICKETS_PER_ORDER,
    selected?.remaining ?? MAX_TICKETS_PER_ORDER
  );
  const total = (selected?.priceXaf ?? 0) * quantity;

  const select = (option: TicketOption) => {
    setSelectedId(option.id);
    setQuantity((q) => Math.min(q, Math.min(MAX_TICKETS_PER_ORDER, option.remaining)));
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      {ticketTypes.map((option) => {
        const soldOut = option.remaining <= 0;
        const active = option.id === selectedId;

        return (
          <button
            key={option.id}
            type="button"
            disabled={soldOut}
            onClick={() => select(option)}
            aria-pressed={active}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "border-brand bg-brand/10"
                : "border-white/10 bg-card hover:border-brand/40"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden
                className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                  active ? "border-brand bg-brand" : "border-white/30"
                }`}
              />
              <span>
                <span className="block text-[14px] font-semibold">
                  {option.name}
                </span>
                <span className="block text-[12px] text-smoke">
                  {soldOut ? t("soldOut") : t("remaining", { count: option.remaining })}
                </span>
              </span>
            </span>
            <span className="font-display text-[15px] font-extrabold">
              {option.priceLabel}
            </span>
          </button>
        );
      })}

      {selected && (
        <>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-card px-4 py-3">
            <span className="text-[14px] font-semibold">{t("quantity")}</span>
            <span className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(MIN_TICKETS_PER_ORDER, q - 1))}
                disabled={quantity <= MIN_TICKETS_PER_ORDER}
                aria-label="−"
                className="h-8 w-8 rounded-full border border-white/15 text-lg leading-none disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center font-display text-[16px] font-extrabold">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                aria-label="+"
                className="h-8 w-8 rounded-full border border-white/15 text-lg leading-none disabled:opacity-40"
              >
                +
              </button>
            </span>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-[14px] text-mist">{t("total")}</span>
            <span className="font-display text-2xl font-extrabold text-brand">
              {formatPriceXaf(total)}
            </span>
          </div>
        </>
      )}

      {!isSignedIn ? (
        <Link
          href="/connexion"
          className="rounded-2xl bg-brand px-4 py-3.5 text-center font-display text-[15px] font-extrabold text-white hover:opacity-90"
        >
          {t("signInToBuy")}
        </Link>
      ) : (
        <form action={`/paiement/${eventSlug}`} method="get">
          <input type="hidden" name="billet" value={selectedId} />
          <input type="hidden" name="quantite" value={quantity} />
          <button
            type="submit"
            disabled={!selected}
            className="w-full rounded-2xl bg-brand px-4 py-3.5 font-display text-[15px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
          >
            {t("buy")}
          </button>
        </form>
      )}
    </div>
  );
}
