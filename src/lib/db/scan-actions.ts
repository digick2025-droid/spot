"use server";

import { getTranslations } from "next-intl/server";
import { requireProfile } from "@/lib/auth/dal";
import { parseTicketPayload } from "@/lib/qr";
import { scanTicket, type ScanOutcome } from "./scan";

export type ScanState = {
  outcome: ScanOutcome | null;
  message: string;
  detail: string | null;
  /** Horodatage pour forcer le rendu même sur deux résultats identiques. */
  at: number;
};

export const initialScanState: ScanState = {
  outcome: null,
  message: "",
  detail: null,
  at: 0,
};

/**
 * Valide un billet scanné ou saisi à la main.
 *
 * Point d'entrée public au même titre qu'une route : la session est
 * revérifiée, et l'appartenance de l'événement est contrôlée en base par
 * spot.scan_ticket(), qui détient le verrou.
 */
export async function submitScan(
  _state: ScanState,
  formData: FormData
): Promise<ScanState> {
  const t = await getTranslations("scan");
  const profile = await requireProfile();

  const eventId = String(formData.get("eventId") ?? "");
  const raw = String(formData.get("payload") ?? "").trim();

  if (!eventId || !raw) {
    return {
      outcome: "not_found",
      message: t("results.empty"),
      detail: null,
      at: Date.now(),
    };
  }

  // Un QR fournit « spot:code:secret » ; une saisie manuelle n'a que le
  // code — recevable ici puisque seul l'organisateur peut scanner.
  const parsed = parseTicketPayload(raw);
  const code = parsed?.code ?? raw;
  const secret = parsed?.secret ?? null;

  const result = await scanTicket({
    code,
    secret,
    eventId,
    scannerId: profile.id,
  });

  const detail =
    result.holderName ??
    (result.scannedAt
      ? t("results.scannedAt", {
          time: new Date(result.scannedAt).toLocaleTimeString("fr-FR"),
        })
      : null);

  return {
    outcome: result.outcome,
    message: t(`results.${result.outcome}`),
    detail,
    at: Date.now(),
  };
}
