import { ImageResponse } from "next/og";
import { getEventBySlug, lowestPrice } from "@/lib/db/events";
import { formatEventDate, formatPriceXaf } from "@/lib/format";
import { posterUrl } from "@/lib/posters";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Le spot à partager — ce que voient WhatsApp, Facebook et X quand
 * quelqu'un colle le lien d'une fiche.
 *
 * L'affiche est carrée, et elle est montrée entière, posée à gauche
 * comme une pochette d'album. C'est la seule mise en page qui la
 * respecte : en fond perdu sur un cadre 1200×630, le recadrage mangeait
 * le haut et le bas — précisément là où les organisateurs d'ici
 * écrivent le titre de la soirée et le prix d'entrée.
 *
 * Le dégradé de l'événement occupe le fond, assombri en biais pour que
 * le texte reste lisible et que la couleur continue de rayonner sur le
 * bord droit : c'est le halo du produit, transposé au partage.
 *
 * Pas d'emoji : Satori les rend en téléchargeant des images sur un CDN,
 * dépendance qu'une vignette de partage n'a pas à porter.
 *
 * ⚠ Cette route n'a pas d'extension : elle doit rester hors du matcher du
 * proxy (voir src/proxy.ts), sinon next-intl la préfixe d'une locale et
 * les robots reçoivent une redirection ou un 404.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SPOT — fiche d'un événement";

const INK = "#08080B";
const BRAND = "#FF6B35";
const FALLBACK_GRADIENT = "linear-gradient(135deg,#FF6B35,#C2410C)";

const POSTER_SIZE = 466;

/** Le titre déborderait au-delà de trois lignes : on coupe proprement. */
function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * Les deux teintes d'un dégradé d'événement, en rgba.
 *
 * Le halo se peint en `radial-gradient`, qui réclame une couleur et non
 * la chaîne complète du dégradé. Faute de teinte lisible — un dégradé
 * exprimé autrement qu'en hexadécimal — on retombe sur l'orange de la
 * marque, jamais sur du transparent qui effacerait le halo.
 */
function haloColors(gradient: string): [string, string] {
  const found = gradient.match(/#[0-9a-f]{6}/gi) ?? [];
  const first = found[0] ?? BRAND;
  const second = found[1] ?? first;
  return [first, second];
}

function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Le logo SP●T, dessiné plutôt qu'écrit — la police n'a pas ce point. */
function Wordmark({ size: fontSize, dot }: { size: number; dot: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        color: "#FFFFFF",
        fontSize,
        fontWeight: 800,
        letterSpacing: -2,
      }}
    >
      SP
      <div
        style={{
          width: fontSize * 0.38,
          height: fontSize * 0.38,
          margin: `0 ${fontSize * 0.1}px`,
          borderRadius: fontSize,
          background: dot,
        }}
      />
      T
    </div>
  );
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
          }}
        >
          <Wordmark size={140} dot={BRAND} />
        </div>
      ),
      { ...size }
    );
  }

  const poster = await fetchPoster(posterUrl(event.poster_path));
  const gradient = event.gradient ?? FALLBACK_GRADIENT;
  const [haloA, haloB] = haloColors(gradient);
  const from = lowestPrice(event);
  const label =
    activeLocale === "fr"
      ? Number.isFinite(from)
        ? `Dès ${formatPriceXaf(from)}`
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
          alignItems: "center",
          background: INK,
          padding: 64,
        }}
      >
        {/* Le halo, comme dans l'application : la couleur de l'événement
            rayonne autour de l'affiche et dans le coin opposé, jamais
            sous le texte — qui reste ainsi blanc sur noir, lisible même
            réduit à la vignette d'une conversation WhatsApp. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            display: "flex",
            background: `radial-gradient(circle at 24% 48%, ${rgba(haloA, 0.5)} 0%, ${rgba(haloA, 0)} 55%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            display: "flex",
            background: `radial-gradient(circle at 96% 96%, ${rgba(haloB, 0.42)} 0%, ${rgba(haloB, 0)} 48%)`,
          }}
        />

        {/* L'affiche, entière */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: POSTER_SIZE,
            height: POSTER_SIZE,
            flexShrink: 0,
            borderRadius: 34,
            background: gradient,
            overflow: "hidden",
          }}
        >
          {poster ? (
            // Satori dessine un arbre JSX en image : next/image n'y a pas
            // cours, seule la balise brute est comprise.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              width={POSTER_SIZE}
              height={POSTER_SIZE}
              style={{
                width: POSTER_SIZE,
                height: POSTER_SIZE,
                objectFit: "cover",
              }}
            />
          ) : (
            <Wordmark size={92} dot={INK} />
          )}
        </div>

        {/* La fiche, à droite */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            height: POSTER_SIZE,
            marginLeft: 52,
            flexGrow: 1,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Wordmark size={38} dot={BRAND} />

            <div
              style={{
                display: "flex",
                marginTop: 26,
                color: BRAND,
                fontSize: 25,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              {formatEventDate(event.starts_at, activeLocale).toUpperCase()}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 12,
                color: "#FFFFFF",
                fontSize: 54,
                fontWeight: 800,
                letterSpacing: -2,
                lineHeight: 1.06,
              }}
            >
              {clamp(event.title, 52)}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 16,
                color: "rgba(255,255,255,0.72)",
                fontSize: 27,
              }}
            >
              {clamp(`${event.venue} · ${event.city}`, 44)}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: "rgba(255,255,255,0.62)",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {clamp(event.organizers.name, 38)}
            </div>

            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                marginTop: 16,
                padding: "16px 32px",
                borderRadius: 999,
                background: BRAND,
                color: "#FFFFFF",
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {label}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
