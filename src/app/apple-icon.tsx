import { ImageResponse } from "next/og";
import { SpotIcon } from "@/lib/brand-icon";

/**
 * Icône d'écran d'accueil iOS.
 *
 * Safari ignore les icônes du manifeste : sans ce fichier, « Sur l'écran
 * d'accueil » capturerait une vignette de la page. 180 px est la taille
 * attendue des appareils récents.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<SpotIcon size={size.width} />, { ...size });
}
