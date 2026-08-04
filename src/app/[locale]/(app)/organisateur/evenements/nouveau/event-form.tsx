"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createPosterUpload, discardPoster } from "@/lib/db/organizer-actions";
import {
  initialOrganizerFormState,
  type OrganizerFormState,
} from "@/lib/db/organizer-state";
import { createClient } from "@/lib/supabase/client";
import {
  POSTER_BUCKET,
  POSTER_MAX_BYTES,
  POSTER_MIME_TYPES,
  posterExtension,
} from "@/lib/posters";

/** Trois paliers comme dans la maquette ; seul le premier est exigé. */
const TIERS = [0, 1, 2] as const;

const FIELD =
  "rounded-2xl border border-fog bg-paper-card px-4 py-3 text-[15px] text-ink placeholder:text-smoke focus:border-brand focus:outline-none";

const LABEL = "text-[13px] font-semibold text-smoke";

/**
 * Le formulaire est contrôlé, champ par champ.
 *
 * React réinitialise un formulaire après l'exécution de son action : sur
 * une erreur de validation, une saisie non contrôlée disparaissait
 * entièrement et tout était à refaire. Les valeurs vivent donc dans
 * l'état, où aucune réinitialisation ne les atteint.
 */
type Values = Record<string, string>;

const INITIAL_VALUES: Values = {
  title: "",
  category: "",
  glyph: "🎟",
  description: "",
  date: "",
  time: "18:00",
  city: "",
  venue: "",
  tierName0: "Standard",
  tierPrice0: "5000",
  tierQuantity0: "100",
  tierName1: "VIP",
  tierPrice1: "",
  tierQuantity1: "",
  tierName2: "",
  tierPrice2: "",
  tierQuantity2: "",
};

/**
 * L'affiche, elle, ne transite plus par la Server Action.
 *
 * Une action Next est plafonnée à 1 Mo de corps : une photo ordinaire la
 * dépassait, et la publication échouait sans que le formulaire puisse
 * seulement dire pourquoi. Le fichier part donc du navigateur vers
 * Storage — la policy RLS y veille comme avant, le dossier étant celui de
 * l'organisateur — et seul son chemin accompagne le formulaire.
 *
 * Il part dès la sélection : l'organisateur voit sa vignette et le mot
 * « importée » avant de publier, et une erreur de validation ne lui fait
 * pas retéléverser son image.
 */
type PosterState =
  | { status: "empty" }
  | { status: "uploading"; preview: string }
  | { status: "ready"; preview: string; path: string }
  | { status: "failed"; message: string };

export function EventForm({
  categories,
  action,
  initialValues,
  initialPoster,
  submitLabel,
  submittingLabel,
  hint,
}: {
  categories: { key: string; label: string }[];
  action: (
    state: OrganizerFormState,
    formData: FormData
  ) => Promise<OrganizerFormState>;
  initialValues?: Partial<Values>;
  initialPoster?: { path: string; url: string } | null;
  submitLabel: string;
  submittingLabel: string;
  hint: string;
}) {
  const t = useTranslations("organizer");
  const [state, formAction, pending] = useActionState(
    action,
    initialOrganizerFormState
  );

  const [values, setValues] = useState<Values>(() => ({
    ...INITIAL_VALUES,
    ...initialValues,
  }) as Values);
  const [poster, setPoster] = useState<PosterState>(
    initialPoster
      ? { status: "ready", preview: initialPoster.url, path: initialPoster.path }
      : { status: "empty" }
  );

  const set =
    (key: string) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  /** Retire de Storage une affiche remplacée ou abandonnée. */
  const discard = async (path: string) => {
    try {
      await discardPoster(path);
    } catch {
      // Le fichier restera dans le bucket sans être référencé : gênant
      // pour le ménage, sans conséquence pour l'organisateur.
    }
  };

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Le champ est vidé aussitôt : il ne sert qu'à choisir, et un même
    // fichier resélectionné doit redéclencher l'import.
    event.target.value = "";
    if (!file) return;

    if (poster.status === "ready") await discard(poster.path);
    if (poster.status !== "empty" && "preview" in poster) {
      URL.revokeObjectURL(poster.preview);
    }

    const extension = posterExtension(file.type);
    if (!extension || file.size > POSTER_MAX_BYTES) {
      setPoster({ status: "failed", message: t("errors.invalidPoster") });
      return;
    }

    const preview = URL.createObjectURL(file);
    setPoster({ status: "uploading", preview });

    // Le serveur choisit le chemin et signe le dépôt ; le navigateur ne
    // fait que pousser les octets, sans avoir besoin d'une session.
    const opened = await createPosterUpload(file.type);
    if (!opened.ok) {
      URL.revokeObjectURL(preview);
      setPoster({ status: "failed", message: opened.error });
      return;
    }

    const { error } = await createClient()
      .storage.from(POSTER_BUCKET)
      .uploadToSignedUrl(opened.path, opened.token, file, {
        contentType: file.type,
      });

    if (error) {
      URL.revokeObjectURL(preview);
      setPoster({ status: "failed", message: t("errors.posterUpload") });
      return;
    }

    setPoster({ status: "ready", preview, path: opened.path });
  };

  const onRemove = async () => {
    if (poster.status === "ready") {
      URL.revokeObjectURL(poster.preview);
      await discard(poster.path);
    }
    setPoster({ status: "empty" });
  };

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      {poster.status === "ready" && (
        <input type="hidden" name="posterPath" value={poster.path} />
      )}

      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("titleLabel")}</span>
        <input
          name="title"
          required
          minLength={3}
          maxLength={120}
          value={values.title}
          onChange={set("title")}
          placeholder={t("titlePlaceholder")}
          className={FIELD}
        />
      </label>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("categoryLabel")}</span>
          <select
            name="category"
            value={values.category}
            onChange={set("category")}
            className={FIELD}
          >
            <option value="">{t("noCategory")}</option>
            {categories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("glyphLabel")}</span>
          <input
            name="glyph"
            maxLength={4}
            value={values.glyph}
            onChange={set("glyph")}
            className={`${FIELD} text-center text-[20px]`}
          />
        </label>
      </div>

      {/* L'affiche : vignette dès la sélection, import immédiat. */}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>{t("posterLabel")}</span>

        <div className="flex items-center gap-4 rounded-2xl border border-fog bg-paper-card p-3">
          {poster.status === "uploading" || poster.status === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster.preview}
              alt=""
              className={`h-20 w-20 shrink-0 rounded-xl object-cover transition-opacity ${
                poster.status === "uploading" ? "opacity-50" : "opacity-100"
              }`}
            />
          ) : (
            <span
              aria-hidden
              className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-paper text-[26px]"
            >
              🖼
            </span>
          )}

          <div className="min-w-0 flex-1">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-ink px-4 py-2 font-display text-[13px] font-extrabold text-white hover:opacity-90">
              {poster.status === "ready" ? t("posterReplace") : t("posterPick")}
              <input
                type="file"
                accept={POSTER_MIME_TYPES.join(",")}
                onChange={onPick}
                className="sr-only"
              />
            </label>

            <p aria-live="polite" className="mt-1.5 text-[12px] text-smoke">
              {poster.status === "uploading" && t("posterUploading")}
              {poster.status === "ready" && (
                <span className="font-semibold text-success">
                  {t("posterReady")}
                </span>
              )}
              {poster.status === "failed" && (
                <span className="font-semibold text-danger">
                  {poster.message}
                </span>
              )}
              {(poster.status === "empty" || poster.status === "failed") &&
                ` ${t("posterHint")}`}
            </p>
          </div>

          {poster.status === "ready" && (
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 text-[13px] font-semibold text-smoke underline underline-offset-4 hover:text-danger"
            >
              {t("posterRemove")}
            </button>
          )}
        </div>
      </div>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>{t("descriptionLabel")}</span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          value={values.description}
          onChange={set("description")}
          placeholder={t("descriptionPlaceholder")}
          aria-describedby="description-hint"
          className={`${FIELD} resize-y`}
        />
        <span id="description-hint" className="text-[12px] text-smoke">
          {t("descriptionHint")}
        </span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("dateLabel")}</span>
          <input
            name="date"
            type="date"
            required
            value={values.date}
            onChange={set("date")}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("timeLabel")}</span>
          <input
            name="time"
            type="time"
            required
            value={values.time}
            onChange={set("time")}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("cityLabel")}</span>
          <input
            name="city"
            required
            maxLength={60}
            value={values.city}
            onChange={set("city")}
            placeholder={t("cityPlaceholder")}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className={LABEL}>{t("venueLabel")}</span>
          <input
            name="venue"
            required
            maxLength={120}
            value={values.venue}
            onChange={set("venue")}
            placeholder={t("venuePlaceholder")}
            className={FIELD}
          />
        </label>
      </div>

      <fieldset>
        <legend className="font-display text-[14px] font-extrabold">
          {t("tiersTitle")}
        </legend>
        <p className="mt-1 text-[12px] text-smoke">{t("tiersHint")}</p>

        <div className="mt-3 flex flex-col gap-2.5">
          {TIERS.map((index) => (
            <div key={index} className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <input
                name={`tierName${index}`}
                maxLength={40}
                required={index === 0}
                value={values[`tierName${index}`]}
                onChange={set(`tierName${index}`)}
                aria-label={t("tierName")}
                placeholder={t("tierName")}
                className={FIELD}
              />
              <input
                name={`tierPrice${index}`}
                type="number"
                min={0}
                step={100}
                inputMode="numeric"
                required={index === 0}
                value={values[`tierPrice${index}`]}
                onChange={set(`tierPrice${index}`)}
                aria-label={t("tierPrice")}
                placeholder={t("tierPrice")}
                className={FIELD}
              />
              <input
                name={`tierQuantity${index}`}
                type="number"
                min={1}
                inputMode="numeric"
                required={index === 0}
                value={values[`tierQuantity${index}`]}
                onChange={set(`tierQuantity${index}`)}
                aria-label={t("tierQuantity")}
                placeholder={t("tierQuantity")}
                className={FIELD}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-[13px] text-danger"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || poster.status === "uploading"}
        className="rounded-2xl bg-brand px-4 py-3.5 font-display text-[15px] font-extrabold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? submittingLabel : submitLabel}
      </button>
      <p className="text-center text-[12px] text-smoke">{hint}</p>
    </form>
  );
}
