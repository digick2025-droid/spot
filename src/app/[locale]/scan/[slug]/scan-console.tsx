"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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

const TONE: Record<string, string> = {
  ok: "border-success bg-success/15 text-success",
  already_used: "border-warning bg-warning/15 text-warning",
  void: "border-danger bg-danger/15 text-danger",
  wrong_event: "border-danger bg-danger/15 text-danger",
  not_found: "border-danger bg-danger/15 text-danger",
  forbidden: "border-danger bg-danger/15 text-danger",
};

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

  return (
    <div className="mt-5 flex flex-col gap-4">
      {state.outcome && (
        <div
          role="status"
          aria-live="assertive"
          className={`rounded-2xl border px-4 py-4 text-center ${
            TONE[state.outcome] ?? "border-white/15 bg-card"
          }`}
        >
          <p className="font-display text-[16px] font-extrabold">{state.message}</p>
          {state.detail && <p className="mt-1 text-[13px]">{state.detail}</p>}
        </div>
      )}

      {supported ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`aspect-square w-full object-cover ${cameraOn ? "" : "hidden"}`}
          />
          <div className="p-3">
            <button
              type="button"
              onClick={cameraOn ? stopCamera : startCamera}
              className="w-full rounded-xl bg-brand px-4 py-3 font-display text-[14px] font-extrabold text-white hover:opacity-90"
            >
              {cameraOn ? t("stopCamera") : t("startCamera")}
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-card px-4 py-3 text-[13px] text-mist">
          {t("cameraUnsupported")}
        </p>
      )}

      {cameraError && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-[13px] text-danger"
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
          <input
            ref={payloadRef}
            name="payload"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="A1B2C3D4E5F6"
            className="rounded-2xl border border-white/10 bg-card px-4 py-3.5 font-mono text-[15px] uppercase tracking-widest text-white placeholder:text-smoke focus:border-brand focus:outline-none"
          />
        </label>
        <span className="text-[12px] text-smoke">{t("manualHint")}</span>
        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-2xl border border-white/15 px-4 py-3 font-display text-[14px] font-extrabold hover:border-brand/50 disabled:opacity-50"
        >
          {pending ? t("validating") : t("validate")}
        </button>
      </form>
    </div>
  );
}
