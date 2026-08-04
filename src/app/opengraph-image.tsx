import { ImageResponse } from "next/og";

/**
 * Vignette de partage par défaut — celle qui accompagne un lien SPOT
 * collé dans WhatsApp quand la page n'en fournit pas de plus précise.
 *
 * Dessinée plutôt que stockée, comme les icônes : aucun binaire dans le
 * dépôt. Aucun emoji ici — Satori les rend en allant chercher des images
 * sur un CDN, ce qui ferait dépendre une vignette de partage d'un tiers.
 *
 * Placée à la racine de `app/`, elle est héritée par toutes les routes ;
 * la fiche d'un événement la remplace par la sienne.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SPOT — Les événements qui bougent";

const INK = "#0B0B0F";
const BRAND = "#FF6B35";
const MIST = "#A1A1AA";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: INK,
          padding: 90,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: "#FFFFFF",
            fontSize: 150,
            fontWeight: 800,
            letterSpacing: -6,
          }}
        >
          SP
          <div
            style={{
              width: 58,
              height: 58,
              margin: "0 14px",
              borderRadius: 58,
              background: BRAND,
            }}
          />
          T
        </div>

        <div style={{ display: "flex", marginTop: 24, fontSize: 46, color: "#FFFFFF" }}>
          Les événements qui bougent.
        </div>

        <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: MIST }}>
          Douala · Yaoundé · Bafoussam — billets en Mobile Money
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 46,
            height: 8,
            width: 220,
            borderRadius: 8,
            background: BRAND,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
