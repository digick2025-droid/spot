import { ImageResponse } from "next/og";
import { getEventBySlug, lowestPrice } from "@/lib/db/events";
import { formatEventDate, formatPriceXaf } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Vignette de partage d'un événement — ce que voient WhatsApp, Facebook
 * et X quand quelqu'un colle le lien de la fiche.
 *
 * Le dégradé de l'événement sert de fond ; le titre, la date, le lieu et
 * le prix d'entrée sont dessinés par-dessus. Pas d'emoji : Satori les
 * rend en téléchargeant des images sur un CDN, dépendance qu'une vignette
 * de partage n'a pas à porter.
 *
 * ⚠ Cette route n'a pas d'extension : elle doit rester hors du matcher du
 * proxy (voir src/proxy.ts), sinon next-intl la préfixe d'une locale et
 * les robots reçoivent une redirection ou un 404.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SPOT — fiche d'un événement";

const INK = "#0B0B0F";
const BRAND = "#FF6B35";
const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

/** Le titre déborderait au-delà de deux lignes : on coupe proprement. */
function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * L'affiche, ramenée en data: URI pour être dessinée dans la vignette.
 *
 * Satori sait charger une URL distante, mais un échec surviendrait alors
 * pendant le rendu — donc trop tard pour se rabattre sur autre chose, et
 * la vignette partirait en erreur. On récupère les octets d'abord : si
 * Storage ne répond pas dans les trois secondes, le partage se contente
 * du dégradé, ce qui vaut mieux qu'un lien sans image.
 */
async function fetchPoster(url: string | null): Promise<string | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function EventOpengraphImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const activeLocale: Locale = routing.locales.includes(locale as Locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  const event = await getEventBySlug(slug);

  // Événement inconnu (lien périmé, brouillon dépublié) : on rend la
  // vignette de marque plutôt qu'une erreur, qui laisserait le lien nu.
  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: INK,
            color: "#FFFFFF",
            fontSize: 140,
            fontWeight: 800,
          }}
        >
          SP
          <div
            style={{
              width: 54,
              height: 54,
              margin: "0 13px",
              borderRadius: 54,
              background: BRAND,
            }}
          />
          T
        </div>
      ),
      { ...size }
    );
  }

  const poster = await fetchPoster(posterUrl(event.poster_path));
  const from = lowestPrice(event);
  const label =
    activeLocale === "fr"
      ? Number.isFinite(from)
        ? `À partir de ${formatPriceXaf(from)}`
        : "Entrée libre"
      : Number.isFinite(from)
        ? `From ${formatPriceXaf(from)}`
        : "Free entry";

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: event.gradient ?? FALLBACK_GRADIENT,
          padding: 72,
        }}
      >
        {/* L'affiche en fond, sous un voile sombre : sans lui, un titre
            blanc posé sur une image claire deviendrait illisible. */}
        {poster && (
          // Satori dessine un arbre JSX en image : next/image n'y a pas
          // cours, seule la balise brute est comprise.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt=""
            width={size.width}
            height={size.height}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size.width,
              height: size.height,
              objectFit: "cover",
            }}
          />
        )}
        {poster && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size.width,
              height: size.height,
              display: "flex",
              // Léger en haut, où l'affiche doit rester lisible ; dense
              // en bas, où passent le titre et le prix.
              background:
                "linear-gradient(180deg, rgba(11,11,15,0.28), rgba(11,11,15,0.86))",
            }}
          />
        )}

        {/* Bandeau supérieur : la marque, puis la date */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "#FFFFFF",
              fontSize: 46,
              fontWeight: 800,
              letterSpacing: -2,
            }}
          >
            SP
            <div
              style={{
                width: 18,
                height: 18,
                margin: "0 5px",
                borderRadius: 18,
                // Sur une affiche voilée de sombre, un point encre
                // disparaîtrait ; sur un dégradé clair, c'est l'inverse.
                background: poster ? "#FFFFFF" : INK,
              }}
            />
            T
          </div>

          <div
            style={{
              display: "flex",
              padding: "12px 26px",
              borderRadius: 999,
              background: "rgba(11,11,15,0.55)",
              color: "#FFFFFF",
              fontSize: 28,
            }}
          >
            {formatEventDate(event.starts_at, activeLocale)}
          </div>
        </div>

        {/* Le titre, puis le lieu */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "#FFFFFF",
              fontSize: 84,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.05,
            }}
          >
            {clamp(event.title, 60)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              color: "rgba(255,255,255,0.86)",
              fontSize: 34,
            }}
          >
            {clamp(`${event.venue} · ${event.city}`, 70)}
          </div>
        </div>

        {/* Le prix d'entrée, sur une souche de billet */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "18px 34px",
              borderRadius: 999,
              background: INK,
              color: "#FFFFFF",
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            {label}
          </div>
          <div
            style={{
              display: "flex",
              color: poster ? "rgba(255,255,255,0.82)" : "rgba(11,11,15,0.75)",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {clamp(event.organizers.name, 40)}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
