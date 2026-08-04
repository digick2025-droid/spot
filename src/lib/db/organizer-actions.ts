"use server";

import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  POSTER_BUCKET,
  isOwnPosterPath,
  posterExtension,
} from "@/lib/posters";
import type { PosterUpload } from "./poster-state";
import { getMyOrganizer } from "./organizer";
import type { OrganizerFormState } from "./organizer-state";

/** Dégradés de la maquette, tirés au sort faute d'affiche à téléverser. */
const GRADIENTS = [
  "linear-gradient(135deg,#FF6B35,#C2410C)",
  "linear-gradient(135deg,#8B5CF6,#4C1D95)",
  "linear-gradient(135deg,#FF6B35,#8B5CF6)",
  "linear-gradient(135deg,#C2410C,#FF6B35)",
  "linear-gradient(135deg,#52525B,#18181B)",
] as const;

function randomGradient(): string {
  return GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
}

/**
 * Identifiant d'URL lisible.
 *
 * Le suffixe aléatoire évite la collision sur le `unique` du slug : deux
 * « Festival Afro » sont légitimes, une erreur Postgres à la publication
 * ne le serait pas.
 */
function slugify(value: string): string {
  const base = value
    .normalize("NFD")
    // Décomposé puis dépouillé de ses accents : « Été » donne « ete »,
    // pas « t ».
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const suffix = Math.random().toString(36).slice(2, 7);
  return base ? `${base}-${suffix}` : suffix;
}

const organizerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  glyph: z.string().trim().max(4).optional(),
});

/**
 * Crée la fiche organisateur de l'utilisateur courant.
 *
 * Point d'entrée public : la session est revérifiée ici, et la policy
 * organizers_insert_own impose que owner_id soit bien l'appelant.
 */
export async function createOrganizer(
  _state: OrganizerFormState,
  formData: FormData
): Promise<OrganizerFormState> {
  const t = await getTranslations("organizer");
  const profile = await requireProfile();

  const parsed = organizerSchema.safeParse({
    name: formData.get("name"),
    glyph: formData.get("glyph") ?? undefined,
  });
  if (!parsed.success) return { error: t("errors.invalidOrganizer") };

  // Une seule fiche par compte en Phase 1 : le second envoi d'un
  // formulaire resté ouvert ne doit pas en créer une deuxième.
  const existing = await getMyOrganizer();
  if (existing) {
    const locale = await getLocale();
    return redirect({ href: "/organisateur", locale });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organizers").insert({
    owner_id: profile.id,
    name: parsed.data.name,
    slug: slugify(parsed.data.name),
    glyph: parsed.data.glyph || "🎪",
    gradient: randomGradient(),
  });

  if (error) {
    console.error("[organisateur] création de la fiche échouée", error);
    return { error: t("errors.unavailable") };
  }

  const locale = await getLocale();
  return redirect({ href: "/organisateur", locale });
}

/**
 * Ouvre un dépôt d'affiche et rend l'URL signée qui va avec.
 *
 * Le fichier ne peut pas transiter par la publication : une Server Action
 * plafonne à 1 Mo de corps, une photo ordinaire ne passerait pas. Il part
 * donc du navigateur directement vers Storage — mais le jeton est émis
 * ici, sous la session du serveur, pour deux raisons : la lisibilité des
 * cookies de session côté navigateur n'a rien de garanti, et c'est le
 * serveur qui choisit le chemin. L'organisateur n'a jamais la main sur le
 * dossier où atterrit son image.
 */
export async function createPosterUpload(
  mimeType: string
): Promise<PosterUpload> {
  const t = await getTranslations("organizer");
  await requireProfile();

  const organizer = await getMyOrganizer();
  if (!organizer) return { ok: false, error: t("errors.noOrganizer") };

  const extension = posterExtension(mimeType);
  if (!extension) return { ok: false, error: t("errors.invalidPoster") };

  const supabase = await createClient();
  const path = `${organizer.id}/${crypto.randomUUID()}.${extension}`;

  // Signée sous l'identité de l'appelant : la policy d'écriture du bucket
  // s'applique ici, à l'émission du jeton.
  const { data, error } = await supabase.storage
    .from(POSTER_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[organisateur] ouverture du dépôt d'affiche échouée", error);
    return { ok: false, error: t("errors.posterUpload") };
  }

  return { ok: true, path, token: data.token };
}

/** Retire une affiche remplacée ou abandonnée avant publication. */
export async function discardPoster(path: string): Promise<void> {
  await requireProfile();

  const organizer = await getMyOrganizer();
  if (!organizer || !isOwnPosterPath(path, organizer.id)) return;

  const supabase = await createClient();
  await supabase.storage.from(POSTER_BUCKET).remove([path]);
}

const tierSchema = z.object({
  name: z.string().trim().min(1).max(40),
  price: z.coerce.number().int().min(0).max(10_000_000),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
});

const eventSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Certains navigateurs ajoutent les secondes à un <input type="time"> :
  // on les accepte, la construction de la date les ignore.
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  city: z.string().trim().min(2).max(60),
  venue: z.string().trim().min(2).max(120),
  category: z.string().trim().max(40).optional(),
  glyph: z.string().trim().max(4).optional(),
});

/**
 * Publie un événement et ses types de billets.
 *
 * L'organisateur écrit ici sous sa propre identité : les policies
 * events_insert_own et ticket_types_write_own vérifient qu'il possède
 * bien l'organisateur, il n'y a donc rien à faire en service_role.
 */
export async function createEvent(
  _state: OrganizerFormState,
  formData: FormData
): Promise<OrganizerFormState> {
  const t = await getTranslations("organizer");
  await requireProfile();

  const organizer = await getMyOrganizer();
  if (!organizer) return { error: t("errors.noOrganizer") };

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    date: formData.get("date"),
    time: formData.get("time"),
    city: formData.get("city"),
    venue: formData.get("venue"),
    category: formData.get("category") ?? undefined,
    glyph: formData.get("glyph") ?? undefined,
  });
  if (!parsed.success) return { error: t("errors.invalidEvent") };

  // Le Cameroun ne pratique pas l'heure d'été : Africa/Douala vaut UTC+1
  // toute l'année, l'offset peut donc être écrit en dur.
  const time = parsed.data.time.slice(0, 5);
  const startsAt = new Date(`${parsed.data.date}T${time}:00+01:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: t("errors.invalidDate") };
  if (startsAt.getTime() <= Date.now()) return { error: t("errors.pastDate") };

  const tiers: z.infer<typeof tierSchema>[] = [];
  for (const i of [0, 1, 2]) {
    // Les lignes vides sont facultatives : seule la première est exigée.
    const name = `${formData.get(`tierName${i}`) ?? ""}`.trim();
    if (name === "") continue;

    const tier = tierSchema.safeParse({
      name,
      price: formData.get(`tierPrice${i}`),
      quantity: formData.get(`tierQuantity${i}`),
    });
    if (!tier.success) return { error: t("errors.invalidTiers") };
    tiers.push(tier.data);
  }

  if (tiers.length === 0) return { error: t("errors.invalidTiers") };

  // L'affiche est déjà dans Storage : le formulaire l'y a déposée depuis
  // le navigateur, une Server Action plafonnant à 1 Mo de corps — une
  // photo ordinaire ne serait jamais arrivée jusqu'ici. On ne reçoit donc
  // qu'un chemin, écrit par le client, et il se vérifie.
  const submittedPath = `${formData.get("posterPath") ?? ""}`.trim();
  if (submittedPath && !isOwnPosterPath(submittedPath, organizer.id)) {
    return { error: t("errors.invalidPoster") };
  }
  const posterPath = submittedPath || null;

  const supabase = await createClient();

  // La description saisie est recopiée dans les deux langues : la fiche
  // publique n'affiche que la colonne de la locale visitée, un seul
  // remplissage laisserait l'autre page vide.
  const description = parsed.data.description || null;

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      organizer_id: organizer.id,
      category_key: parsed.data.category || null,
      title: parsed.data.title,
      slug: slugify(parsed.data.title),
      description_fr: description,
      description_en: description,
      city: parsed.data.city,
      venue: parsed.data.venue,
      starts_at: startsAt.toISOString(),
      glyph: parsed.data.glyph || "🎟",
      gradient: randomGradient(),
      poster_path: posterPath,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id, slug")
    .single();

  if (error || !event) {
    // L'affiche déjà déposée reste en place : le formulaire la garde
    // affichée et la renverra au prochain essai. La supprimer ici ferait
    // pointer cette seconde tentative sur un fichier disparu.
    console.error("[organisateur] création de l'événement échouée", error);
    return { error: t("errors.unavailable") };
  }

  const { error: tiersError } = await supabase.from("ticket_types").insert(
    tiers.map((tier, index) => ({
      event_id: event.id,
      name_fr: tier.name,
      name_en: tier.name,
      price_xaf: tier.price,
      quantity_total: tier.quantity,
      sort: index,
    }))
  );

  if (tiersError) {
    // Un événement publié sans billet n'est pas achetable : on retire la
    // coquille plutôt que de la laisser en ligne.
    await supabase.from("events").delete().eq("id", event.id);
    console.error("[organisateur] création des billets échouée", tiersError);
    return { error: t("errors.unavailable") };
  }

  const locale = await getLocale();
  return redirect({ href: "/organisateur", locale });
}
