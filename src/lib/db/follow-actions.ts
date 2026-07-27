"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";

const organizerIdSchema = z.uuid();

/**
 * Suit ou arrête de suivre un organisateur.
 *
 * Point d'entrée public au même titre qu'une route : la session est
 * revérifiée ici, et la RLS (follows_insert_own / follows_delete_own)
 * interdit d'agir sur les abonnements d'autrui.
 *
 * `ignoreDuplicates` rend l'insertion idempotente si deux soumissions se
 * croisent, sans exiger de droit UPDATE : la table n'accorde que select,
 * insert et delete, un upsert classique (on conflict do update) serait
 * refusé par Postgres.
 */
export async function toggleFollow(formData: FormData) {
  const profile = await requireProfile();

  const parsed = organizerIdSchema.safeParse(formData.get("organizerId"));
  if (!parsed.success) return;

  const supabase = await createClient();
  const following = formData.get("following") === "1";

  const { error } = following
    ? await supabase
        .from("follows")
        .delete()
        .eq("user_id", profile.id)
        .eq("organizer_id", parsed.data)
    : await supabase
        .from("follows")
        .upsert(
          { user_id: profile.id, organizer_id: parsed.data },
          { ignoreDuplicates: true }
        );

  if (error) throw new Error(`Abonnement impossible : ${error.message}`);

  refresh();
}
