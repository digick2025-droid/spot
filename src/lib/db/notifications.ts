import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificationType =
  | "points_earned"
  | "payout_paid"
  | "payout_failed"
  | "creator_joined";

export type Notification = {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

const COLUMNS = "id, type, payload, read_at, created_at";

/**
 * Notifications de l'utilisateur courant, les plus récentes d'abord.
 *
 * notifications_select_own fait le filtrage : rien à répéter ici.
 */
export async function getMyNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Lecture des notifications impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as NotificationType,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    readAt: row.read_at as string | null,
    createdAt: row.created_at as string,
  }));
}

/** Compte pour le badge de la cloche — appelant responsable de la session. */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    throw new Error(`Comptage des notifications impossible : ${error.message}`);
  }

  return count ?? 0;
}
