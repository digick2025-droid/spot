import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { EventCard } from "@/components/event-card";
import { listCategories, listCities, listEvents } from "@/lib/db/events";
import { DiscoverFilters } from "./filters";

export default async function DiscoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ville?: string; categorie?: string; q?: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  const { ville, categorie, q } = await searchParams;
  const t = await getTranslations("events");
  const activeLocale = (await getLocale()) as Locale;

  const [events, categories, cities] = await Promise.all([
    listEvents({ city: ville, category: categorie, search: q }),
    listCategories(),
    listCities(),
  ]);

  const isFiltered = Boolean(
    (ville && ville !== "all") || (categorie && categorie !== "all") || q?.trim()
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
        {t("discover")}
      </h1>

      <DiscoverFilters
        cities={cities}
        categories={categories.map((c) => ({
          key: c.key,
          emoji: c.emoji,
          label: activeLocale === "fr" ? c.label_fr : c.label_en,
        }))}
        selectedCity={ville ?? "all"}
        selectedCategory={categorie ?? "all"}
        query={q ?? ""}
      />

      <p className="mt-6 text-[13px] text-smoke">
        {t("resultCount", { count: events.length })}
      </p>

      {events.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-white/10 bg-card p-8 text-center">
          <p className="text-[15px] font-semibold">
            {isFiltered ? t("noResults") : t("empty")}
          </p>
          {isFiltered && (
            <p className="mt-2 text-[13px] text-mist">{t("noResultsHint")}</p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
