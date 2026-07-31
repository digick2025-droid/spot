"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * Marque toutes les notifications non lues de l'utilisateur courant
 * comme lues.
 *
 * Le grant côté client ne porte que sur la colonne read_at
 * (`grant update (read_at)`) : impossible de toucher au contenu d'une
 * notification, la sienne ou celle de quelqu'un d'autre.
 */
export async function markAllNotificationsRead() {
  await requireProfile();

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) {
    throw new Error(`Marquage des notifications impossible : ${error.message}`);
  }

  refresh();
}
