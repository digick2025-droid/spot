"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

/**
 * `beforeinstallprompt` n'est pas standardisé : absent de lib.dom, absent
 * de Safari. On en déclare le strict nécessaire plutôt que d'élargir les
 * types globaux pour un événement d'un seul moteur.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** « installé » (donc rien à proposer), « iOS » (mode d'emploi), ou le reste. */
type Surface = "installed" | "ios" | "other";

const MEDIA = "(display-mode: standalone)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(MEDIA);
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function getSnapshot(): Surface {
  // `navigator.standalone` est la variante iOS, absente des types.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;

  if (window.matchMedia(MEDIA).matches || iosStandalone === true) {
    return "installed";
  }
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "other";
}

/**
 * Sur le serveur, rien n'est connu de l'appareil. On répond « installé » :
 * la carte est donc absente du HTML initial et apparaît après hydratation,
 * plutôt que de s'afficher puis de disparaître sous les yeux.
 */
function getServerSnapshot(): Surface {
  return "installed";
}

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
  const surface = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Sans preventDefault, Chrome affiche sa propre bannière au moment
      // qui l'arrange — on préfère la proposer à cet endroit-ci.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

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
            setDeferred(null);
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
