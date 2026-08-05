import type { ReactNode } from "react";

/**
 * Briques de la vitrine publique — reprises de la maquette de la landing
 * (artifact « SP●T — Les événements qui bougent »).
 *
 * Rien ici n'est spécifique à une page : les trois écrans (accueil,
 * organisateurs, creators) empilent les mêmes bandes, les mêmes cartes et
 * la même perforation de billet. Les couleurs viennent des jetons `@theme`
 * de `globals.css`, jamais de valeurs en dur.
 */

/** Largeur de lecture commune à toute la vitrine. */
export function Wrap({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-[min(1080px,100%-2.5rem)] ${className}`}>
      {children}
    </div>
  );
}

/** Bande verticale : le rythme de la page. */
export function Band({
  children,
  tight = false,
  className = "",
}: {
  children: ReactNode;
  tight?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`relative ${
        tight
          ? "py-[clamp(2.75rem,5.5vw,4.5rem)]"
          : "py-[clamp(3.5rem,8vw,7rem)]"
      } ${className}`}
    >
      {children}
    </section>
  );
}

/** Surtitre : un tiret de couleur, puis le libellé en petites capitales. */
export function Eyebrow({
  children,
  tone = "brand",
  className = "",
}: {
  children: ReactNode;
  tone?: "brand" | "accent";
  className?: string;
}) {
  return (
    <p
      className={`mb-[1.1rem] flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-smoke ${className}`}
    >
      <span
        aria-hidden
        className={`h-0.5 w-7 rounded-sm ${
          tone === "accent" ? "bg-accent" : "bg-brand"
        }`}
      />
      {children}
    </p>
  );
}

/**
 * Séparateur de bande : la ligne pointillée d'un billet à détacher, avec
 * sa pastille orange au milieu.
 */
export function Perforation() {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-0 w-[min(1080px,100%-2.5rem)] border-t-2 border-dashed border-white/10"
    >
      <span className="absolute -top-[9px] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-brand" />
    </div>
  );
}

/** Carte de contenu : un numéro d'ordre, un titre, un paragraphe. */
export function Card({
  label,
  title,
  children,
  tone = "brand",
  className = "",
}: {
  label?: string;
  title: string;
  children: ReactNode;
  tone?: "brand" | "accent";
  className?: string;
}) {
  return (
    <div
      className={`sheen rounded-card bg-surface px-[1.4rem] py-[1.35rem] transition-transform hover:-translate-y-0.5 ${className}`}
    >
      {label && (
        <span
          className={`font-display mb-[0.7rem] block text-[0.72rem] font-extrabold tracking-[0.1em] ${
            tone === "accent" ? "text-accent" : "text-brand-bright"
          }`}
        >
          {label}
        </span>
      )}
      <h3 className="font-display mb-1.5 text-[1.0625rem] font-extrabold tracking-tight">
        {title}
      </h3>
      <p className="text-[0.9rem] text-mist">{children}</p>
    </div>
  );
}

/** Suite d'étapes numérotées — le compteur est explicite, pas décoratif. */
export function Steps({
  items,
  tone = "brand",
}: {
  items: { title: string; body: string }[];
  tone?: "brand" | "accent";
}) {
  return (
    <ol className="mt-[2.2rem] grid gap-[0.9rem]">
      {items.map((item, index) => (
        <li
          key={item.title}
          className="sheen flex items-start gap-[1.1rem] rounded-card bg-surface px-[1.3rem] py-[1.15rem]"
        >
          <span
            aria-hidden
            className={`font-display flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[0.82rem] font-extrabold text-white ${
              tone === "accent" ? "grad-night" : "grad-ember"
            }`}
          >
            {index + 1}
          </span>
          <div>
            <h3 className="font-display text-[1.0625rem] font-extrabold tracking-tight">
              {item.title}
            </h3>
            <p className="mt-0.5 text-[0.89rem] text-mist">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Le billet de la maquette : un corps, une ligne perforée, une souche.
 *
 * Les deux pastilles de la perforation sont peintes de la couleur du fond
 * et débordent du cadre — c'est le `overflow-hidden` du billet qui les
 * coupe en deux et creuse l'encoche. D'où `notchClassName`, qui doit
 * suivre le fond de la bande où le billet est posé.
 */
export function Ticket({
  children,
  stub,
  variant = "dark",
}: {
  children: ReactNode;
  stub: ReactNode;
  /** « light » pour les bandes claires de l'espace Organisateur. */
  variant?: "dark" | "light";
}) {
  const light = variant === "light";

  return (
    <div
      className={`relative overflow-hidden rounded-sheet shadow-[0_24px_60px_-28px_rgba(0,0,0,0.9)] ${
        light
          ? "border border-paper-line bg-paper-card text-ink"
          : "sheen bg-surface"
      }`}
    >
      <div className="px-[1.7rem] pb-[1.45rem] pt-[1.6rem]">{children}</div>
      <div
        aria-hidden
        className={`relative border-t-2 border-dashed ${
          light ? "border-black/20" : "border-white/20"
        }`}
      >
        <span
          className={`absolute -left-3 -top-3 h-6 w-6 rounded-full ${
            light ? "bg-paper" : "bg-ink"
          }`}
        />
        <span
          className={`absolute -right-3 -top-3 h-6 w-6 rounded-full ${
            light ? "bg-paper" : "bg-ink"
          }`}
        />
      </div>
      <div className="px-[1.7rem] pb-6 pt-[1.2rem]">{stub}</div>
    </div>
  );
}

/**
 * Bouton de la vitrine — même forme que les CTA de la maquette.
 *
 * « ghostLight » est la variante posée sur une bande claire (héros de
 * l'espace Organisateur) : seul le contour change, la forme est la même.
 */
export function ctaClassName(
  variant: "brand" | "accent" | "ghost" | "ghostLight" = "brand"
): string {
  const base =
    "inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-display text-[0.9rem] font-extrabold transition-[transform,box-shadow,border-color,color] hover:-translate-y-0.5";

  if (variant === "brand") {
    return `${base} grad-ember glow-brand border border-transparent text-white`;
  }
  if (variant === "accent") {
    return `${base} grad-night border border-transparent text-white shadow-[0_10px_30px_-12px_rgba(139,92,246,0.65)]`;
  }
  if (variant === "ghostLight") {
    return `${base} border border-black/15 text-ink hover:border-brand hover:text-brand-deep`;
  }
  return `${base} border border-white/20 hover:border-brand hover:text-brand`;
}
