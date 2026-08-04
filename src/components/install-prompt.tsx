"use client";

import { useTranslations } from "next-intl";
import { useInstallSurface } from "./install-surface";

/**
 * Invitation à installer SPOT sur l'écran d'accueil.
 *
 * Trois situations, trois rendus :
 *
 * · déjà installé → rien. Proposer d'installer ce qui l'est déjà ferait
 *   douter de ce qu'on regarde.
 * · Chromium (Android, desktop) → un vrai bouton, via l'événement
 *   `beforeinstallprompt` qu'on retient au vol. La doc Next décourage ce
 *   chemin parce qu'il n'est pas universel ; il reste le seul moyen
 *   d'offrir un bouton là où il existe, et le repli ci-dessous couvre le
 *   reste.
 * · iOS → le mode d'emploi, Safari n'exposant aucune API d'installation.
 *
 * Ailleurs (Firefox desktop, navigateurs sans installation), rien ne
 * s'affiche : mieux vaut le silence qu'une consigne inapplicable.
 */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const { surface, deferred, clearDeferred } = useInstallSurface();

  if (surface === "installed") return null;
  if (!deferred && surface !== "ios") return null;

  return (
    <section className="mt-8 rounded-[20px] border border-white/10 bg-card p-5">
      <h2 className="font-display text-[15px] font-extrabold">
        <span aria-hidden>📲</span> {t("installTitle")}
      </h2>
      <p className="mt-1.5 text-[13px] text-mist">{t("installHint")}</p>

      {deferred ? (
        <button
          type="button"
          onClick={async () => {
            await deferred.prompt();
            // Un événement retenu n'est utilisable qu'une fois : qu'elle
            // soit acceptée ou refusée, l'invitation disparaît.
            await deferred.userChoice;
            clearDeferred();
          }}
          className="mt-4 w-full rounded-2xl bg-brand px-5 py-3 font-display text-[14px] font-extrabold text-white transition-opacity hover:opacity-90"
        >
          {t("installAction")}
        </button>
      ) : (
        <p className="mt-3 text-[13px] text-fog">{t("iosHint")}</p>
      )}
    </section>
  );
}
