import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/dal";
import type { WithdrawalStatus } from "./balances";

/**
 * Les demandes de retrait, côté administration.
 *
 * C'est la seule écriture de la console : SPOT verse à la main sur le
 * Mobile Money du bénéficiaire, puis marque la ligne. Sans ce geste, une
 * demande resterait ouverte pour toujours et le solde de l'organisateur
 * serait bloqué — l'argent, lui, serait bien parti.
 *
 * Lecture en service_role après requireAdmin : le nom du bénéficiaire
 * vit dans spot.profiles, que sa RLS réserve à son propriétaire. La
 * garde est donc faite ici, explicitement, avant de la contourner.
 */

export type AdminWithdrawal = {
  id: string;
  reference: string;
  kind: "organizer" | "creator";
  amountXaf: number;
  phone: string;
  channel: "mtn_momo" | "orange_money";
  status: WithdrawalStatus;
  createdAt: string;
  settledAt: string | null;
  beneficiary: string;
  /** Ce que le retrait concerne : la fiche organisateur ou la campagne. */
  target: string;
};

type Row = {
  id: string;
  reference: string;
  kind: "organizer" | "creator";
  amount_xaf: number;
  phone: string;
  channel: "mtn_momo" | "orange_money";
  status: WithdrawalStatus;
  created_at: string;
  settled_at: string | null;
  user_id: string;
  organizers: { name: string } | null;
  campaigns: { name: string; events: { title: string } | null } | null;
};

export async function listAdminWithdrawals(): Promise<AdminWithdrawal[]> {
  await requireAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("withdrawals")
    .select(
      `id, reference, kind, amount_xaf, phone, channel, status, created_at,
       settled_at, user_id,
       organizers ( name ),
       campaigns ( name, events ( title ) )`
    )
    // Les demandes ouvertes d'abord : ce sont les seules sur lesquelles
    // il y a quelque chose à faire.
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100)
    .overrideTypes<Row[], { merge: false }>();

  if (error) throw new Error(`Lecture des retraits impossible : ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", [...new Set(rows.map((row) => row.user_id))]);

  const names = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null }[]).map((row) => [
      row.id,
      row.full_name,
    ])
  );

  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    amountXaf: row.amount_xaf,
    phone: row.phone,
    channel: row.channel,
    status: row.status,
    createdAt: row.created_at,
    settledAt: row.settled_at,
    beneficiary: names.get(row.user_id) ?? "—",
    target:
      row.kind === "organizer"
        ? (row.organizers?.name ?? "—")
        : (row.campaigns?.events?.title ?? row.campaigns?.name ?? "—"),
  }));
}
