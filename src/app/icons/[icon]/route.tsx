import { ImageResponse } from "next/og";
import { SpotIcon } from "@/lib/brand-icon";

/**
 * Icônes de l'application, dessinées plutôt que stockées.
 *
 * Les quatre variantes sont générées au build (`generateStaticParams` +
 * `force-static`) : aucun binaire dans le dépôt, aucun rendu à chaud.
 *
 * L'extension « .png » dans l'URL n'est pas décorative : le proxy
 * n'intercepte que les chemins SANS point (voir src/proxy.ts), donc une
 * route nommée « /icons/192 » se ferait préfixer d'une locale et le
 * manifeste pointerait dans le vide.
 */
export const dynamic = "force-static";

const SIZES = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "192-maskable.png": { size: 192, maskable: true },
  "512-maskable.png": { size: 512, maskable: true },
} as const;

export function generateStaticParams() {
  return Object.keys(SIZES).map((icon) => ({ icon }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ icon: string }> }
) {
  const { icon } = await params;
  const spec = SIZES[icon as keyof typeof SIZES];

  if (!spec) {
    return new Response("Icône inconnue", { status: 404 });
  }

  return new ImageResponse(
    <SpotIcon size={spec.size} maskable={spec.maskable} />,
    { width: spec.size, height: spec.size }
  );
}
