"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DoneIcon, ShareIcon } from "./icons";

/**
 * Partage d'un événement.
 *
 * Sur téléphone, `navigator.share` ouvre la feuille du système — celle
 * où WhatsApp arrive en premier, qui est la façon dont un spot circule
 * réellement ici. Là où l'API n'existe pas (ordinateurs de bureau, pour
 * l'essentiel), le lien part dans le presse-papiers et le bouton le dit.
 *
 * Un partage annulé par l'utilisateur remonte en `AbortError` : ce n'est
 * pas un échec, et il ne doit surtout pas déclencher le repli.
 */
export function ShareButton({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const t = useTranslations("events");
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? (
        <DoneIcon size={16} strokeWidth={2.5} aria-hidden />
      ) : (
        <ShareIcon size={16} strokeWidth={2.2} aria-hidden />
      )}
      {copied ? t("linkCopied") : t("share")}
    </button>
  );
}
