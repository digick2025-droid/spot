import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { requireProfile } from "@/lib/auth/dal";
import { listCategories } from "@/lib/db/events";
import { getMyOrganizer } from "@/lib/db/organizer";
import { createEvent } from "@/lib/db/organizer-actions";
import { EventForm } from "./event-form";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireProfile();
  const activeLocale = (await getLocale()) as Locale;

  // Sans fiche organisateur il n'y a rien à rattacher l'événement :
  // le tableau de bord propose la création, c'est là qu'on renvoie.
  const organizer = await getMyOrganizer();
  if (!organizer) {
    return redirect({ href: "/organisateur", locale: activeLocale });
  }

  const t = await getTranslations("organizer");
  const tApp = await getTranslations("app");
  const categories = await listCategories();

  return (
    <main className="flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <Link
          href="/organisateur"
          className="text-[13px] font-semibold text-smoke hover:text-ink"
        >
          ← {t("backToDashboard")}
        </Link>

        <h1 className="font-display mt-4 text-2xl font-extrabold">
          {tApp("createEvent")}
        </h1>

        <EventForm
          categories={categories.map((category) => ({
            key: category.key,
            label: `${category.emoji} ${
              activeLocale === "fr" ? category.label_fr : category.label_en
            }`,
          }))}
          action={createEvent}
          submitLabel={t("publish")}
          submittingLabel={t("publishing")}
          hint={t("publishHint")}
        />
      </div>
    </main>
  );
}
