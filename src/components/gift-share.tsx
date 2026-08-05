"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CopyIcon, DoneIcon, ShareIcon } from "./icons";

/**
 * L'envoi d'un cadeau.
 *
 * Un billet offert ne part pas par e-mail : la plateforme n'a pas
 * d'expéditeur transactionnel, et de toute façon un cadeau se transmet
 * ici par WhatsApp. `navigator.share` ouvre la feuille du système, où
 * WhatsApp arrive en premier ; ailleurs — un ordinateur de bureau, pour
 * l'essentiel — le lien part dans le presse-papiers, et le bouton le dit.
 *
 * Le texte accompagne le lien : reçu seul, un lien de cadeau ressemble à
 * n'importe quel lien suspect, et ne s'ouvre pas.
 */
export function GiftShare({
  url,
  eventTitle,
  className = "",
}: {
  url: string;
  eventTitle: string;
  className?: string;
}) {
  const t = useTranslations("gift");
  const [copied, setCopied] = useState(false);

  const message = `${t("whatsappText", { event: eventTitle })} ${url}`;

  async function send() {
    if (navigator.share) {
      try {
        await navigator.share({ text: message, url });
        return;
      } catch (error) {
        // Un partage annulé n'est pas un échec : surtout ne pas basculer
        // sur le presse-papiers derrière le dos de l'utilisateur.
        if ((error as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      className={`press font-display inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-extrabold ${className}`}
    >
      {copied ? (
        <DoneIcon size={15} strokeWidth={2.6} aria-hidden />
      ) : (
        <ShareIcon size={15} strokeWidth={2.2} aria-hidden />
      )}
      {copied ? t("shareCopy") : t("shareWhatsApp")}
    </button>
  );
}

/** Le lien nu, pour qui préfère le coller lui-même. */
export function GiftLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={url}
      className="press inline-flex max-w-full items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[12px] text-mist ring-1 ring-inset ring-white/12 hover:text-white"
    >
      {copied ? (
        <DoneIcon size={14} strokeWidth={2.6} aria-hidden />
      ) : (
        <CopyIcon size={14} strokeWidth={2.2} aria-hidden />
      )}
      <span className="truncate">{url}</span>
    </button>
  );
}
