"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertIcon,
  CloseIcon,
  DoneIcon,
  LoadingIcon,
  ScanIcon,
} from "@/components/icons";
import { submitScan } from "@/lib/db/scan-actions";
import { initialScanState } from "@/lib/db/scan-state";

/**
 * BarcodeDetector n'est pas dans lib.dom : Chrome et Edge l'implémentent,
 * Firefox et Safari non. D'où la déclaration minimale et le repli manuel.
 */
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * Le verdict, à l'entrée d'une salle : c'est la couleur et le pictogramme
 * qui sont lus, pas la phrase. Le portier a une file devant lui, la nuit,
 * et une seconde par personne — d'où le bloc pleine largeur, la teinte
 * franche et l'icône qui dit passe / attention / refusé.
 */
const VERDICT: Record<
  string,
  { tone: string; icon: "ok" | "warn" | "no" }
> = {
  ok: { tone: "bg-success/15 text-success ring-success", icon: "ok" },
  already_used: {
    tone: "bg-warning/15 text-warning ring-warning",
    icon: "warn",
  },
  void: { tone: "bg-danger/15 text-danger ring-danger", icon: "no" },
  wrong_event: { tone: "bg-danger/15 text-danger ring-danger", icon: "no" },
  not_found: { tone: "bg-danger/15 text-danger ring-danger", icon: "no" },
  forbidden: { tone: "bg-danger/15 text-danger ring-danger", icon: "no" },
};

function VerdictIcon({ kind }: { kind: "ok" | "warn" | "no" }) {
  if (kind === "ok") return <DoneIcon size={30} strokeWidth={3} />;
  if (kind === "warn") return <AlertIcon size={28} strokeWidth={2.4} />;
  return <CloseIcon size={28} strokeWidth={3} />;
}

export function ScanConsole({ eventId }: { eventId: string }) {
  const t = useTranslations("scan");
  const [state, action, pending] = useActionState(submitScan, initialScanState);

  const formRef = useRef<HTMLFormElement>(null);
  const payloadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Dernier code envoyé, pour ne pas boucler sur le même QR. */
  const lastSentRef = useRef<{ value: string; at: number }>({ value: "", at: 0 });

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const supported =
    typeof window !== "undefined" && typeof window.BarcodeDetector === "function";

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError(t("cameraDenied"));
    }
  };

  // Arrêt propre : une caméra laissée ouverte vide la batterie du portier.
  useEffect(() => stopCamera, []);

  useEffect(() => {
    if (!cameraOn || !supported) return;

    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
    let cancelled = false;

    const tick = async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;

      try {
        const codes = await detector.detect(videoRef.current);
        const value = codes[0]?.rawValue;
        if (!value) return;

        // Le même QR reste dans le champ plusieurs secondes : on ne
        // renvoie pas la même valeur en boucle.
        const now = Date.now();
        if (value === lastSentRef.current.value && now - lastSentRef.current.at < 3000) {
          return;
        }
        lastSentRef.current = { value, at: now };

        if (payloadRef.current) payloadRef.current.value = value;
        formRef.current?.requestSubmit();
      } catch {
        // Trame illisible : on réessaiera au prochain passage.
      }
    };

    const timer = setInterval(tick, 400);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cameraOn, supported]);

  const verdict = state.outcome ? VERDICT[state.outcome] : undefined;

  return (
    <div className="mt-5 flex flex-col gap-4">
      {state.outcome && (
        <div
          role="status"
          aria-live="assertive"
          className={`flex items-center gap-4 rounded-card px-5 py-4 ring-1 ring-inset ${
            verdict?.tone ?? "bg-surface ring-white/15"
          }`}
        >
          {verdict && (
            <span aria-hidden className="shrink-0">
              <VerdictIcon kind={verdict.icon} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="font-display block text-[17px] font-extrabold leading-tight">
              {state.message}
            </span>
            {state.detail && (
              <span className="mt-1 block text-[13px] opacity-90">
                {state.detail}
              </span>
            )}
          </span>
        </div>
      )}

      {supported ? (
        <div className="overflow-hidden rounded-sheet bg-surface ring-1 ring-inset ring-white/10">
          <div className="relative">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`aspect-square w-full object-cover ${cameraOn ? "" : "hidden"}`}
            />
            {/* La mire : quatre coins qui disent où présenter le billet.
                Sans elle, on tend le téléphone au hasard. */}
            {cameraOn && (
              <span aria-hidden className="pointer-events-none absolute inset-0">
                <span className="absolute inset-[14%]">
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-[3px] border-t-[3px] border-white/85" />
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-[3px] border-t-[3px] border-white/85" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-[3px] border-l-[3px] border-white/85" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-[3px] border-r-[3px] border-white/85" />
                </span>
              </span>
            )}
          </div>
          <div className="p-3">
            <button
              type="button"
              onClick={cameraOn ? stopCamera : startCamera}
              className={`press font-display flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[14px] font-extrabold ${
                cameraOn
                  ? "bg-surface-high text-fog ring-1 ring-inset ring-white/12"
                  : "grad-ember glow-brand text-white"
              }`}
            >
              {cameraOn ? (
                <CloseIcon size={16} strokeWidth={2.6} aria-hidden />
              ) : (
                <ScanIcon size={16} strokeWidth={2.4} aria-hidden />
              )}
              {cameraOn ? t("stopCamera") : t("startCamera")}
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-card bg-surface px-4 py-3 text-[13px] text-mist ring-1 ring-inset ring-white/10">
          {t("cameraUnsupported")}
        </p>
      )}

      {cameraError && (
        <p
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-3 text-[13px] text-danger ring-1 ring-inset ring-danger/40"
        >
          {cameraError}
        </p>
      )}

      <form ref={formRef} action={action} className="flex flex-col gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-fog">
            {t("manualLabel")}
          </span>
          {/* Le code se saisit à la main quand le QR est rayé ou l'écran
              cassé : la saisie reste en chasse fixe et bien espacée pour
              qu'on relise ce qu'on tape. */}
          <input
            ref={payloadRef}
            name="payload"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="A1B2C3D4E5F6"
            className="rounded-2xl bg-surface px-4 py-3.5 font-mono text-[15px] uppercase tracking-widest text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
          />
        </label>
        <span className="text-[12px] text-smoke">{t("manualHint")}</span>
        <button
          type="submit"
          disabled={pending}
          className="press font-display mt-1 flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-[14px] font-extrabold ring-1 ring-inset ring-white/15 hover:ring-brand/60 disabled:opacity-60"
        >
          {pending && (
            <LoadingIcon
              size={16}
              strokeWidth={2.6}
              className="animate-spin"
              aria-hidden
            />
          )}
          {pending ? t("validating") : t("validate")}
        </button>
      </form>
    </div>
  );
}
