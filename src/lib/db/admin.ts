import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/auth/dal";

/**
 * Lectures de la console d'administration.
 *
 * Tout passe par les fonctions spot.admin_*, appelées avec la session de
 * l'utilisateur : c'est la base qui vérifie le rôle, pas ce module. Une
 * garde oubliée côté page ne donnerait donc accès à rien.
 *
 * La console est en lecture seule : aucune écriture n'est exposée ici, et
 * il n'y a pas de Server Action correspondante.
 */

/** Les sept onglets de la maquette, dans son ordre. */
export const ADMIN_TABS = [
  "users",
  "organizers",
  "events",
  "payments",
  "commissions",
  "creators",
  "loyalty",
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export function isAdminTab(value: string | undefined): value is AdminTab {
  return ADMIN_TABS.includes(value as AdminTab);
}

export type AdminKpis = {
  users_count: number;
  active_events: number;
  processed_volume_xaf: number;
  commissions_month_xaf: number;
};

export type AdminUserRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  tickets: number;
  role: UserRole;
};

export type AdminOrganizerRow = {
  organizer_id: string;
  name: string;
  glyph: string | null;
  events_count: number;
  followers_count: number;
  verified: boolean;
};

export type AdminEventRow = {
  event_id: string;
  title: string;
  glyph: string | null;
  starts_at: string;
  sold: number;
  capacity: number;
  status: "draft" | "published" | "cancelled" | "ended";
};

export type AdminPaymentRow = {
  order_id: string;
  reference: string;
  event_title: string;
  channel: "mtn_momo" | "orange_money" | null;
  total_xaf: number;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  created_at: string;
};

export type AdminCommissionRow = {
  commission_id: string;
  creator_name: string | null;
  campaign_name: string;
  commission_kind: "percent" | "fixed";
  commission_value: number;
  amount_xaf: number;
  created_at: string;
};

export type AdminCreatorRow = {
  creator_id: string;
  full_name: string | null;
  campaigns: number;
  tickets_sold: number;
  commission_xaf: number;
};

export type AdminLoyaltyRow = {
  user_id: string;
  full_name: string | null;
  points: number;
  last_points: number | null;
  last_event_title: string | null;
  last_at: string | null;
};

/**
 * Un refus de la base (42501) et une panne ne se ressemblent pas, mais
 * les deux arrivent ici sous forme d'erreur PostgREST. On les laisse
 * remonter telles quelles : la page n'est atteignable que par un admin,
 * donc un 42501 signalerait une incohérence qu'il vaut mieux voir.
 */
async function callAdmin<T>(fn: string, args: Record<string, unknown> = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);

  if (error) {
    throw new Error(`Lecture « ${fn} » impossible : ${error.message}`);
  }
  return (data ?? []) as T[];
}

export async function getAdminKpis(): Promise<AdminKpis> {
  const rows = await callAdmin<AdminKpis>("admin_kpis");
  // La fonction rend toujours exactement une ligne ; le repli à zéro
  // évite un écran en erreur si elle changeait un jour d'avis.
  return (
    rows[0] ?? {
      users_count: 0,
      active_events: 0,
      processed_volume_xaf: 0,
      commissions_month_xaf: 0,
    }
  );
}

export const getAdminUsers = () =>
  callAdmin<AdminUserRow>("admin_users", { p_limit: 50 });

export const getAdminOrganizers = () =>
  callAdmin<AdminOrganizerRow>("admin_organizers", { p_limit: 50 });

export const getAdminEvents = () =>
  callAdmin<AdminEventRow>("admin_events", { p_limit: 50 });

export const getAdminPayments = () =>
  callAdmin<AdminPaymentRow>("admin_payments", { p_limit: 50 });

export const getAdminCommissions = () =>
  callAdmin<AdminCommissionRow>("admin_commissions", { p_limit: 50 });

export const getAdminCreators = () =>
  callAdmin<AdminCreatorRow>("admin_creators", { p_limit: 50 });

export const getAdminLoyalty = () =>
  callAdmin<AdminLoyaltyRow>("admin_loyalty", { p_limit: 50 });
