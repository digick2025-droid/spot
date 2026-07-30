"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Bouton « Copier » de la maquette.
 *
 * L'écriture dans le presse-papiers peut être refusée (contexte non
 * sécurisé, permission navigateur) : dans ce cas le libellé ne change
 * pas, et le texte reste sélectionnable à la main juste à côté.
 */
export function CopyButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const t = useTranslations("app");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? t("copied") : t("copy")}
    </button>
  );
}
