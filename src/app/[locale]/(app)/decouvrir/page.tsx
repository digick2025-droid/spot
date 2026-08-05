import { getTranslations, setRequestLocale, getLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { EventCard } from "@/components/event-card";
import { InstallBanner } from "@/components/install-banner";
import { OrganizerCta } from "@/components/organizer-cta";
import { getOwnedOrganizers, getUser } from "@/lib/auth/dal";
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
  const tApp = await getTranslations("app");
  const activeLocale = (await getLocale()) as Locale;

  const [events, categories, cities, user, ownedOrganizers] = await Promise.all([
    listEvents({ city: ville, category: categorie, search: q }),
    listCategories(),
    listCities(),
    getUser(),
    getOwnedOrganizers(),
  ]);

  const isFiltered = Boolean(
    (ville && ville !== "all") || (categorie && categorie !== "all") || q?.trim()
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-10 pt-6">
      <h1 className="font-display text-[30px] font-extrabold uppercase">
        {tApp("explore")}
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

      {/* Le visiteur venu d'un lien partagé n'a pas de session : c'est à
          lui, et à lui seul, que l'invitation à installer s'adresse. */}
      {!user && <InstallBanner />}

      <p className="mt-6 text-[13px] text-smoke">
        {t("resultCount", { count: events.length })}
      </p>

      {events.length === 0 ? (
        <div className="sheen mt-6 rounded-sheet bg-surface p-8 text-center">
          <p className="text-[15px] font-semibold">
            {isFiltered ? t("noResults") : t("empty")}
          </p>
          {isFiltered && (
            <p className="mt-2 text-[13px] text-mist">{t("noResultsHint")}</p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {events.map((event, index) => (
            <EventCard key={event.id} event={event} index={index} />
          ))}
        </div>
      )}

      {/* L'appel aux organisateurs ferme la page plutôt que de l'ouvrir :
          on vient ici chercher une soirée, pas une offre. Il n'a rien à
          dire à qui tient déjà une maison. */}
      {ownedOrganizers.length === 0 && (
        <div className="mt-10">
          <OrganizerCta />
        </div>
      )}
    </main>
  );
}
