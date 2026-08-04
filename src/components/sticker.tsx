import type { ReactNode } from "react";

/**
 * Les stickers de SPOT.
 *
 * Un sticker n'est pas une pastille : ce qui le fait lire comme tel,
 * c'est la découpe — le liseré clair qui en fait le tour, comme un
 * autocollant détouré, et l'ombre portée qui le décolle du fond. Le
 * dégradé vient ensuite.
 *
 * Ils servent aujourd'hui aux badges du SPOT PASS. Ils sont pensés pour
 * ce qui vient : quand les participants raconteront leurs moments et que
 * les organisateurs commenteront leurs événements, ce sont ces mêmes
 * stickers qu'on posera sur une photo ou au fil d'une discussion — d'où
 * la rotation légère, qui n'a de sens qu'une fois collé quelque part.
 */

/** Les teintes disponibles, alignées sur les dégradés de la marque. */
export type StickerTone = "ember" | "heat" | "night" | "mist";

const TONE_CLASS: Record<StickerTone, string> = {
  /** Braise : la teinte par défaut, celle de la marque. */
  ember: "grad-ember",
  /** Or : ce qui touche à l'argent, aux paliers, aux récompenses. */
  heat: "grad-heat",
  /** Nuit : le premium, le SPOT PASS, ce qui se mérite. */
  night: "grad-night",
  /** Gris : un sticker encore verrouillé, ou hors sujet. */
  mist: "bg-white/10",
};

const SIZE_CLASS = {
  sm: "h-11 w-11 text-[17px]",
  md: "h-14 w-14 text-[22px]",
  lg: "h-20 w-20 text-[30px]",
} as const;

/**
 * Inclinaisons possibles, tirées de la clé du sticker plutôt qu'au
 * hasard : un même badge doit pencher pareil d'un écran à l'autre, sinon
 * il saute à chaque rendu.
 */
const TILTS = ["-rotate-6", "-rotate-3", "rotate-3", "rotate-6"] as const;

function tiltFor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i += 1) sum += seed.charCodeAt(i);
  return TILTS[sum % TILTS.length];
}

export function Sticker({
  children,
  tone = "ember",
  size = "md",
  seed,
  muted = false,
  className = "",
}: {
  /** Le contenu collé au centre : une icône, un emoji, une lettre. */
  children: ReactNode;
  tone?: StickerTone;
  size?: keyof typeof SIZE_CLASS;
  /** Fixe l'inclinaison. Sans lui, le sticker reste droit. */
  seed?: string;
  /** Verrouillé ou inactif : la couleur se retire, la forme reste. */
  muted?: boolean;
  className?: string;
}) {
  const tilt = seed ? tiltFor(seed) : "";

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full leading-none text-white ring-[3px] ring-white/90 ${
        muted
          ? "bg-white/10 ring-white/25 grayscale"
          : `${TONE_CLASS[tone]} shadow-[0_6px_16px_-6px_rgb(0_0_0/0.85)]`
      } ${SIZE_CLASS[size]} ${tilt} ${className}`}
    >
      {children}
    </span>
  );
}
