import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type CategoryChip = { key: string; emoji: string; label: string };

/**
 * Filtres sans JavaScript : les puces sont des liens, la recherche un
 * formulaire GET. Tout l'état vit dans l'URL, donc la page reste
 * partageable et fonctionne même si le script n'a pas encore chargé.
 */
export async function DiscoverFilters({
  cities,
  categories,
  selectedCity,
  selectedCategory,
  query,
}: {
  cities: string[];
  categories: CategoryChip[];
  selectedCity: string;
  selectedCategory: string;
  query: string;
}) {
  const t = await getTranslations("events");

  const hrefWith = (patch: { ville?: string; categorie?: string }) => {
    const next = new URLSearchParams();
    const ville = patch.ville ?? selectedCity;
    const categorie = patch.categorie ?? selectedCategory;

    if (ville !== "all") next.set("ville", ville);
    if (categorie !== "all") next.set("categorie", categorie);
    if (query) next.set("q", query);

    const qs = next.toString();
    return qs ? `/decouvrir?${qs}` : "/decouvrir";
  };

  // La puce active porte la braise ; les autres restent des surfaces, pour
  // qu'on repère le filtre en cours sans lire toute la ligne.
  const chipClass = (active: boolean) =>
    `press whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${
      active
        ? "grad-ember glow-brand text-white"
        : "bg-surface text-mist ring-1 ring-inset ring-white/10 hover:text-white"
    }`;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <form className="flex gap-2">
        {selectedCity !== "all" && (
          <input type="hidden" name="ville" value={selectedCity} />
        )}
        {selectedCategory !== "all" && (
          <input type="hidden" name="categorie" value={selectedCategory} />
        )}
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
          className="min-w-0 flex-1 rounded-2xl bg-surface px-4 py-3 text-[14px] text-white ring-1 ring-inset ring-white/10 placeholder:text-smoke focus:outline-none focus:ring-brand"
        />
        <button
          type="submit"
          className="press grad-ember glow-brand font-display rounded-2xl px-5 py-3 text-[14px] font-extrabold text-white"
        >
          {t("search")}
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href={hrefWith({ ville: "all" })} className={chipClass(selectedCity === "all")}>
          {t("allCities")}
        </Link>
        {cities.map((city) => (
          <Link
            key={city}
            href={hrefWith({ ville: city })}
            className={chipClass(selectedCity === city)}
          >
            {city}
          </Link>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link
          href={hrefWith({ categorie: "all" })}
          className={chipClass(selectedCategory === "all")}
        >
          {t("allCategories")}
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.key}
            href={hrefWith({ categorie: cat.key })}
            className={chipClass(selectedCategory === cat.key)}
          >
            {cat.emoji} {cat.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
