import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ScanOutcome =
  | "ok"
  | "already_used"
  | "void"
  | "wrong_event"
  | "not_found"
  | "forbidden";

export type ScanResult = {
  outcome: ScanOutcome;
  ticketId: string | null;
  holderName: string | null;
  typeFr: string | null;
  typeEn: string | null;
  scannedAt: string | null;
};

/**
 * Valide un billet à l'entrée.
 *
 * L'autorisation est vérifiée DANS la fonction Postgres, pas ici : c'est
 * elle qui détient le verrou, et une vérification faite en amont pourrait
 * être contournée par un autre appelant.
 */
export async function scanTicket(params: {
  code: string;
  secret: string | null;
  eventId: string;
  scannerId: string;
}): Promise<ScanResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("scan_ticket", {
    p_code: params.code,
    p_secret: params.secret,
    p_event_id: params.eventId,
    p_scanner: params.scannerId,
  });

  if (error) throw new Error(`Scan impossible : ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      outcome: "not_found",
      ticketId: null,
      holderName: null,
      typeFr: null,
      typeEn: null,
      scannedAt: null,
    };
  }

  return {
    outcome: row.outcome as ScanOutcome,
    ticketId: row.ticket_id ?? null,
    holderName: row.holder_name ?? null,
    typeFr: row.type_fr ?? null,
    typeEn: row.type_en ?? null,
    scannedAt: row.scanned_at ?? null,
  };
}

export type ScannableEvent = {
  id: string;
  slug: string;
  title: string;
  city: string;
  venue: string;
  starts_at: string;
  glyph: string | null;
  gradient: string | null;
};

/** Événements que l'utilisateur courant peut contrôler à l'entrée. */
export async function listScannableEvents(): Promise<ScannableEvent[]> {
  const supabase = await createClient();

  // La RLS (events_select_own) restreint déjà aux événements dont
  // l'utilisateur possède l'organisateur.
  const { data, error } = await supabase
    .from("events")
    .select("id, slug, title, city, venue, starts_at, glyph, gradient")
    .in("status", ["published", "ended"])
    .order("starts_at", { ascending: true });

  if (error) throw new Error(`Lecture des événements impossible : ${error.message}`);
  return data ?? [];
}

/** Compteurs d'entrée pour le tableau de bord du scan. */
export async function eventScanCounts(eventId: string): Promise<{
  total: number;
  used: number;
}> {
  const supabase = await createClient();

  const [{ count: total }, { count: used }] = await Promise.all([
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "used"),
  ]);

  return { total: total ?? 0, used: used ?? 0 };
}
