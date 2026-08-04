"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * `beforeinstallprompt` n'est pas standardisé : absent de lib.dom, absent
 * de Safari. On en déclare le strict nécessaire plutôt que d'élargir les
 * types globaux pour un événement d'un seul moteur.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** « installé » (donc rien à proposer), « iOS » (mode d'emploi), ou le reste. */
export type Surface = "installed" | "ios" | "other";

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
 * l'invitation est donc absente du HTML initial et apparaît après
 * hydratation, plutôt que de s'afficher puis de disparaître sous les yeux.
 */
function getServerSnapshot(): Surface {
  return "installed";
}

/**
 * Ce que l'appareil permet de proposer, et l'événement d'installation
 * retenu au vol quand le navigateur en émet un.
 *
 * Partagé par les deux invitations à installer — la carte du compte et le
 * bandeau de la découverte — pour qu'elles ne divergent jamais sur ce
 * qu'est « déjà installé ».
 */
export function useInstallSurface(): {
  surface: Surface;
  deferred: BeforeInstallPromptEvent | null;
  clearDeferred: () => void;
} {
  const surface = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Sans preventDefault, Chrome affiche sa propre bannière au moment
      // qui l'arrange — on préfère la proposer à l'endroit choisi.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  return { surface, deferred, clearDeferred: () => setDeferred(null) };
}
