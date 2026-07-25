import "server-only";
import QRCode from "qrcode";

/**
 * Charge utile d'un billet.
 *
 * Le secret (32 octets aléatoires) est indispensable : sans lui, connaître
 * un identifiant de billet suffirait à en fabriquer un. Le code court sert
 * à retrouver la ligne, le secret à prouver l'authenticité.
 */
export function ticketPayload(code: string, secret: string): string {
  return `spot:${code}:${secret}`;
}

/** Décompose une charge utile scannée. Null si la forme ne convient pas. */
export function parseTicketPayload(
  raw: string
): { code: string; secret: string } | null {
  const parts = raw.trim().split(":");
  if (parts.length !== 3 || parts[0] !== "spot") return null;
  if (!parts[1] || !parts[2]) return null;
  return { code: parts[1], secret: parts[2] };
}

/**
 * Rend le QR en SVG, directement inséré dans la page.
 *
 * SVG plutôt que PNG : net à toute taille, léger, et surtout aucun aller-
 * retour réseau — un billet doit s'afficher à l'entrée d'une salle où la
 * connexion est mauvaise.
 */
export async function ticketQrSvg(code: string, secret: string): Promise<string> {
  return QRCode.toString(ticketPayload(code, secret), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0B0B0F", light: "#FFFFFF" },
  });
}
