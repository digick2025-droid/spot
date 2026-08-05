import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link, redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { BackIcon } from "@/components/icons";
import { requireProfile } from "@/lib/auth/dal";
import { listCategories } from "@/lib/db/events";
import { getMyEvent } from "@/lib/db/organizer";
import { updateEvent, deleteEvent } from "@/lib/db/organizer-actions";
import { posterUrl } from "@/lib/posters";
import { EventForm } from "../nouveau/event-form";
import { DeleteEventButton } from "./delete-event-button";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (hasLocale(routing.locales, locale)) {
    setRequestLocale(locale);
  }

  await requireProfile();
  const activeLocale = (await getLocale()) as Locale;

  const event = await getMyEvent(id);
  if (!event) {
    return redirect({ href: "/organisateur", locale: activeLocale });
  }

  const t = await getTranslations("organizer");
  const categories = await listCategories();

  // Le fuseau est fixe (Africa/Douala, UTC+1 toute l'année) : les champs
  // date et heure se déduisent de starts_at sans dépendre du serveur.
  const starts = new Date(event.starts_at);
  const dateValue = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala",
  }).format(starts);
  const timeValue = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Douala",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(starts);

  const tierValues = Object.fromEntries(
    event.tiers.flatMap((tier) => [
      [`tierName${tier.sort}`, tier.name],
      [`tierPrice${tier.sort}`, `${tier.price_xaf}`],
      [`tierQuantity${tier.sort}`, `${tier.quantity_total}`],
    ])
  );

  const initialValues = {
    title: event.title,
    category: event.category_key ?? "",
    glyph: event.glyph ?? "🎟",
    description: event.description ?? "",
    date: dateValue,
    time: timeValue,
    city: event.city,
    venue: event.venue,
    ...tierValues,
  };

  const posterHref = posterUrl(event.poster_path);
  const initialPoster =
    event.poster_path && posterHref
      ? { path: event.poster_path, url: posterHref }
      : null;

  return (
    <main className="theme-paper flex-1 bg-paper text-ink">
      <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-6 sm:px-6">
        <Link
          href="/organisateur"
          className="press inline-flex items-center gap-1.5 text-[13px] font-semibold text-smoke hover:text-ink"
        >
          <BackIcon size={16} strokeWidth={2.2} aria-hidden />
          {t("backToDashboard")}
        </Link>

        <h1 className="font-display mt-4 text-2xl font-extrabold">
          {t("editEventTitle")}
        </h1>

        <EventForm
          categories={categories.map((category) => ({
            key: category.key,
            label: `${category.emoji} ${
              activeLocale === "fr" ? category.label_fr : category.label_en
            }`,
          }))}
          action={updateEvent.bind(null, event.id)}
          initialValues={initialValues}
          initialPoster={initialPoster}
          submitLabel={t("save")}
          submittingLabel={t("saving")}
          hint={t("editHint")}
        />

        <div className="mt-6 border-t border-paper-line pt-6">
          <DeleteEventButton
            action={deleteEvent.bind(null, event.id)}
            label={t("deleteEvent")}
            pendingLabel={t("deleting")}
            confirmMessage={t("deleteConfirm", { title: event.title })}
          />
          <p className="mt-2 text-center text-[12px] text-smoke">
            {t("deleteHint")}
          </p>
        </div>
      </div>
    </main>
  );
}
