import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";

/**
 * L'argent, vu de chaque côté.
 *
 * Un principe : aucun solde ne se calcule ici. Les sommes viennent de
 * Postgres (spot.organizer_balance), qui les recompose depuis les
 * commandes payées, les frais figés et les commissions. Additionner en
 * TypeScript demanderait de lire toutes les commandes — que PostgREST
 * tronque à 1000 lignes sans le dire, et un revenu se serait mis à
 * baisser tout seul le jour de la millième vente.
 */

export type WithdrawalStatus = "requested" | "paid" | "rejected";

export type OrganizerBalance = {
  /** Encaissé pour ses événements, commandes payées uniquement. */
  revenueXaf: number;
  /** Ce que SPOT prélève — figé commande par commande. */
  platformFeesXaf: number;
  /** Promis aux creators, dû ou déjà versé : il ne le reverra pas. */
  creatorCommissionsXaf: number;
  /** Déjà sorti vers son Mobile Money. */
  withdrawnXaf: number;
  /** Réservé par une demande en cours. */
  requestedXaf: number;
  /** Ce qu'il peut demander maintenant. */
  availableXaf: number;
};

const EMPTY_BALANCE: OrganizerBalance = {
  revenueXaf: 0,
  platformFeesXaf: 0,
  creatorCommissionsXaf: 0,
  withdrawnXaf: 0,
  requestedXaf: 0,
  availableXaf: 0,
};

type BalanceRow = {
  revenue_xaf: number;
  platform_fees_xaf: number;
  creator_commissions_xaf: number;
  withdrawn_xaf: number;
  requested_xaf: number;
  available_xaf: number;
};

/**
 * Solde d'un organisateur.
 *
 * L'appel se fait sous l'identité de l'utilisateur : spot.organizer_balance
 * porte sa propre garde (owns_organizer ou admin) et refuse tout le
 * reste. Inutile de repasser en service_role pour lire ses propres
 * chiffres.
 */
export async function getOrganizerBalance(
  organizerId: string
): Promise<OrganizerBalance> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organizer_balance", {
    p_organizer_id: organizerId,
  });

  if (error) throw new Error(`Lecture du solde impossible : ${error.message}`);

  // La fonction renvoie une table d'une ligne ; le client la type en objet
  // scalaire, d'où la reprise en main ici — comme pour open_payout.
  const row = (data as unknown as BalanceRow[] | null)?.[0];
  if (!row) return EMPTY_BALANCE;

  return {
    revenueXaf: row.revenue_xaf,
    platformFeesXaf: row.platform_fees_xaf,
    creatorCommissionsXaf: row.creator_commissions_xaf,
    withdrawnXaf: row.withdrawn_xaf,
    requestedXaf: row.requested_xaf,
    availableXaf: row.available_xaf,
  };
}

/**
 * Taux de prélèvement en vigueur, pour l'afficher à côté du montant.
 *
 * C'est le taux d'aujourd'hui, pas celui qui a servi aux lignes déjà
 * encaissées — celles-là gardent le leur dans spot.platform_fees. Il ne
 * sert donc qu'à annoncer ce qui sera prélevé demain.
 */
export async function getPlatformCommissionPercent(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "platform_commission_percent")
    .maybeSingle()
    .overrideTypes<{ value: number } | null, { merge: false }>();

  if (error) throw new Error(`Lecture des réglages impossible : ${error.message}`);
  return Number(data?.value ?? 0);
}

export type Withdrawal = {
  id: string;
  reference: string;
  amountXaf: number;
  status: WithdrawalStatus;
  createdAt: string;
  settledAt: string | null;
  note: string | null;
};

type WithdrawalRow = {
  id: string;
  reference: string;
  amount_xaf: number;
  status: WithdrawalStatus;
  created_at: string;
  settled_at: string | null;
  note: string | null;
};

/**
 * Demandes de retrait de l'utilisateur courant.
 *
 * withdrawals_select_own borne déjà la lecture, mais le filtre explicite
 * garde la liste juste : withdrawals_select_campaign_owner ouvre aussi
 * la table aux demandes des creators d'un organisateur, et celles-là ne
 * sont pas les siennes.
 */
export async function listMyWithdrawals(kind?: "organizer" | "creator"): Promise<Withdrawal[]> {
  const user = await getUser();
  if (!user) return [];

  const supabase = await createClient();
  let query = supabase
    .from("withdrawals")
    .select("id, reference, amount_xaf, status, created_at, settled_at, note")
    .eq("user_id", user.id);

  if (kind) query = query.eq("kind", kind);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(20)
    .overrideTypes<WithdrawalRow[], { merge: false }>();

  if (error) throw new Error(`Lecture des retraits impossible : ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    reference: row.reference,
    amountXaf: row.amount_xaf,
    status: row.status,
    createdAt: row.created_at,
    settledAt: row.settled_at,
    note: row.note,
  }));
}

/**
 * Campagnes sur lesquelles le creator courant a une demande en cours.
 *
 * Sert à remplacer le bouton par « demande envoyée » : sans cela,
 * l'écran inviterait à redemander ce que l'index partiel refusera.
 */
export async function listOpenCreatorRequests(): Promise<Set<string>> {
  const user = await getUser();
  if (!user) return new Set();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select("campaign_id")
    .eq("user_id", user.id)
    .eq("kind", "creator")
    .eq("status", "requested")
    .overrideTypes<{ campaign_id: string }[], { merge: false }>();

  if (error) throw new Error(`Lecture des demandes impossible : ${error.message}`);
  return new Set((data ?? []).map((row) => row.campaign_id));
}
