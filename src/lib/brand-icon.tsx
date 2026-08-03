import type { ReactElement } from "react";

/** Jetons de la charte, repris de globals.css. */
const INK = "#0B0B0F";
const BRAND = "#FF6B35";

/**
 * Le logo SP●T rendu pour une icône d'application.
 *
 * Le fond couvre toute la surface plutôt que d'être arrondi ici : iOS
 * comme Android appliquent leur propre masque, et un coin déjà arrondi
 * se retrouverait rogné deux fois.
 *
 * Les deux échelles ci-dessous sont des tailles de POLICE, pas des
 * largeurs : « SP●T » occupe environ 2,4 fois sa taille de police, d'où
 * des valeurs qui paraissent petites. À 0,42, le sigle débordait de la
 * toile et les lettres extrêmes étaient rognées.
 *
 * `maskable` va plus loin encore : une icône maskable peut être rognée
 * jusqu'à sa zone sûre — le cercle central de 80 % du côté — et ce qui
 * dépasse disparaît selon le lanceur.
 */
export function SpotIcon({
  size,
  maskable = false,
}: {
  size: number;
  maskable?: boolean;
}): ReactElement {
  const glyph = size * (maskable ? 0.24 : 0.31);
  const dot = glyph * 0.42;

  return (
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          color: "#FFFFFF",
          fontSize: glyph,
          fontWeight: 800,
          letterSpacing: -glyph * 0.03,
        }}
      >
        SP
        <div
          style={{
            width: dot,
            height: dot,
            margin: `0 ${dot * 0.22}px`,
            borderRadius: dot,
            background: BRAND,
          }}
        />
        T
      </div>
    </div>
  );
}
