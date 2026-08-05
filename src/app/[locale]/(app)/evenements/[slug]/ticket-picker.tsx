"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AddIcon, GiftIcon, RemoveIcon, TicketIcon } from "@/components/icons";
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
  const tGift = useTranslations("gift");
  const available = ticketTypes.filter((tt) => tt.remaining > 0);
  const [selectedId, setSelectedId] = useState(available[0]?.id ?? "");
  const [quantity, setQuantity] = useState(MIN_TICKETS_PER_ORDER);
  /**
   * Acheter pour soi ou offrir : deux intentions, un seul tunnel. Le
   * choix ne change ni le prix ni le paiement, seulement le nom qui
   * portera le billet — c'est donc un onglet, pas un autre écran. Le
   * destinataire se saisit à l'étape suivante, dans le formulaire posté
   * au serveur : un prénom n'a rien à faire dans une URL.
   */
  const [gift, setGift] = useState(false);

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
      {/* Les deux intentions, côte à côte. */}
      <div
        role="group"
        className="flex gap-1.5 rounded-full bg-surface p-1.5 ring-1 ring-inset ring-white/10"
      >
        {[
          { key: "buy", label: t("buy"), Icon: TicketIcon, on: false },
          { key: "gift", label: tGift("tabGift"), Icon: GiftIcon, on: true },
        ].map((tab) => {
          const active = gift === tab.on;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setGift(tab.on)}
              aria-pressed={active}
              className={`press font-display flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[13px] font-extrabold transition-colors ${
                active ? "grad-ember text-white" : "text-mist hover:text-white"
              }`}
            >
              <tab.Icon size={15} strokeWidth={2.4} aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>

      {gift && (
        <p className="px-1 text-[12px] leading-relaxed text-smoke">
          {tGift("pickerHint")}
        </p>
      )}

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
            className={`press flex items-center justify-between rounded-card px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "bg-surface-high ring-2 ring-brand"
                : "bg-surface ring-1 ring-white/10 hover:ring-brand/40"
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden
                className={`h-4 w-4 shrink-0 rounded-full ${
                  active ? "grad-ember" : "ring-2 ring-inset ring-white/30"
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
          <div className="flex items-center justify-between rounded-card bg-surface px-4 py-3 ring-1 ring-white/10">
            <span className="text-[14px] font-semibold">{t("quantity")}</span>
            <span className="flex items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setQuantity((q) => Math.max(MIN_TICKETS_PER_ORDER, q - 1))
                }
                disabled={quantity <= MIN_TICKETS_PER_ORDER}
                aria-label={t("quantity")}
                className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 disabled:opacity-40"
              >
                <RemoveIcon size={16} strokeWidth={2.5} aria-hidden />
              </button>
              <span className="font-display w-6 text-center text-[17px] font-extrabold">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                aria-label={t("quantity")}
                className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15 disabled:opacity-40"
              >
                <AddIcon size={16} strokeWidth={2.5} aria-hidden />
              </button>
            </span>
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-[14px] text-mist">{t("total")}</span>
            <span className="text-ember font-display text-[26px] font-extrabold">
              {formatPriceXaf(total)}
            </span>
          </div>
        </>
      )}

      {!isSignedIn ? (
        <Link
          href="/connexion"
          className="press grad-ember glow-brand font-display rounded-2xl px-4 py-4 text-center text-[15px] font-extrabold text-white"
        >
          {t("signInToBuy")}
        </Link>
      ) : (
        <form action={`/paiement/${eventSlug}`} method="get">
          <input type="hidden" name="billet" value={selectedId} />
          <input type="hidden" name="quantite" value={quantity} />
          {gift && <input type="hidden" name="cadeau" value="1" />}
          <button
            type="submit"
            disabled={!selected}
            className="press grad-ember glow-brand font-display flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-[15px] font-extrabold text-white disabled:opacity-50"
          >
            {gift && <GiftIcon size={17} strokeWidth={2.4} aria-hidden />}
            {gift ? tGift("tabGift") : t("buy")}
          </button>
        </form>
      )}
    </div>
  );
}
