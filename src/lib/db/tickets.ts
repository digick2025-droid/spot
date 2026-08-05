import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TicketListItem = {
  id: string;
  code: string;
  status: "valid" | "used" | "void";
  scanned_at: string | null;
  ticket_types: { name_fr: string; name_en: string };
  events: {
    id: string;
    slug: string;
    title: string;
    city: string;
    venue: string;
    starts_at: string;
    glyph: string | null;
    gradient: string | null;
    poster_path: string | null;
  };
};

/** Le secret n'est chargé que pour le détail, où il sert à dessiner le QR. */
export type TicketDetail = TicketListItem & { secret: string };

const LIST_COLUMNS = `
  id, code, status, scanned_at,
  ticket_types ( name_fr, name_en ),
  events ( id, slug, title, city, venue, starts_at, glyph, gradient, poster_path )
`;

/**
 * Billets de l'utilisateur courant.
 *
 * Le client passe par la RLS (policy tickets_select_own) : inutile de
 * filtrer sur holder_id ici, la base s'en charge et c'est elle qui fait
 * autorité.
 */
export async function listMyTickets(): Promise<TicketListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tickets")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .overrideTypes<TicketListItem[], { merge: false }>();

  if (error) throw new Error(`Lecture des billets impossible : ${error.message}`);
  return data ?? [];
}

export async function getMyTicket(id: string): Promise<TicketDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tickets")
    .select(`${LIST_COLUMNS}, secret`)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<TicketDetail | null, { merge: false }>();

  if (error) throw new Error(`Lecture du billet impossible : ${error.message}`);
  return data;
}
