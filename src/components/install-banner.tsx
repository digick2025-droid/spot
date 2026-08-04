"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useInstallSurface } from "./install-surface";

const DISMISSED_KEY = "spot.installBanner.dismissed";

/**
 * Bandeau d'installation, au-dessus du fil de la découverte.
 *
 * Il ne s'adresse qu'au visiteur venu d'un lien partagé : la page appelante
 * ne le monte qu'en l'absence de session (`/decouvrir`). S'y ajoutent deux
 * conditions côté navigateur — l'application n'est pas déjà installée, et
 * le visiteur ne l'a pas écarté.
 *
 * L'oubli est volontairement court (sessionStorage) : au prochain passage,
 * la proposition revient. Une préférence définitive se réglerait dans le
 * compte, pas dans un bandeau.
 */
export function InstallBanner() {
  const t = useTranslations("pwa");
  const { surface, deferred, clearDeferred } = useInstallSurface();
  const [dismissed, setDismissed] = useState(false);

  const alreadyDismissed = () => {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Navigation privée stricte : pas de mémoire, donc pas d'oubli.
      return false;
    }
  };

  if (surface === "installed") return null;
  if (!deferred && surface !== "ios") return null;
  if (dismissed || alreadyDismissed()) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Sans stockage, le bandeau disparaît quand même pour cette vue.
    }
    setDismissed(true);
  };

  return (
    <section className="mt-6 flex items-center gap-3.5 rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/15 to-card px-4 py-3.5">
      <span
        aria-hidden
        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-brand text-[18px]"
      >
        🎟
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-display text-[14px] font-extrabold tracking-tight">
          {t("bannerTitle")}
        </p>
        <p className="mt-0.5 text-[12.5px] text-mist">{t("bannerBody")}</p>
        {!deferred && (
          <p className="mt-1.5 text-[12.5px] text-fog">{t("iosHint")}</p>
        )}
      </div>

      {deferred && (
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt();
            // Un événement retenu n'est utilisable qu'une fois.
            await deferred.userChoice;
            clearDeferred();
          }}
          className="font-display shrink-0 rounded-full bg-brand px-4 py-2 text-[12.5px] font-extrabold text-white transition-opacity hover:opacity-90"
        >
          {t("installAction")}
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label={t("bannerDismiss")}
        className="shrink-0 self-start text-[16px] leading-none text-smoke transition-colors hover:text-white"
      >
        <span aria-hidden>×</span>
      </button>
    </section>
  );
}
