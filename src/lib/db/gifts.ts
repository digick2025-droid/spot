import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Le billet offert, côté données.
 *
 * Un cadeau vit en deux temps : l'acheteur paie et reçoit un lien, la
 * personne l'ouvre et le réclame. Entre les deux, le billet appartient
 * toujours à l'acheteur — c'est ce qui permet de le renvoyer, et ce qui
 * évite qu'un lien perdu fasse disparaître une place payée.
 */

/** Ce qu'on montre à qui ouvre le lien, avant toute connexion. */
export type GiftPreview = {
  ticketId: string;
  recipientName: string | null;
  message: string | null;
  /** Prénom de celui qui offre — jamais son adresse ni son téléphone. */
  fromName: string | null;
  claimed: boolean;
  /** Vrai si c'est déjà le billet de la personne connectée. */
  status: "valid" | "used" | "void";
  event: {
    slug: string;
    title: string;
    city: string;
    venue: string;
    startsAt: string;
    glyph: string | null;
    gradient: string | null;
    posterPath: string | null;
  };
  ticketTypeNameFr: string;
  ticketTypeNameEn: string;
};

/**
 * Aperçu d'un cadeau, par son code.
 *
 * Lecture en service_role, à dessein : la RLS ne montre un billet qu'à
 * son porteur, et le destinataire n'en est pas encore un. La sélection
 * est donc explicite et étroite — ni `secret`, ni `code` d'entrée, rien
 * qui permettrait de fabriquer un QR à partir du seul lien de cadeau.
 */
export async function getGiftPreview(
  claimCode: string
): Promise<GiftPreview | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tickets")
    .select(
      `id, status, claimed_at, gift_recipient_name,
       orders!inner ( gift_message ),
       profiles!tickets_gifted_by_fkey ( full_name ),
       ticket_types!inner ( name_fr, name_en ),
       events!inner ( slug, title, city, venue, starts_at, glyph, gradient, poster_path )`
    )
    .eq("gift_claim_code", claimCode)
    .maybeSingle()
    .overrideTypes<
      {
        id: string;
        status: "valid" | "used" | "void";
        claimed_at: string | null;
        gift_recipient_name: string | null;
        orders: { gift_message: string | null };
        profiles: { full_name: string | null } | null;
        ticket_types: { name_fr: string; name_en: string };
        events: {
          slug: string;
          title: string;
          city: string;
          venue: string;
          starts_at: string;
          glyph: string | null;
          gradient: string | null;
          poster_path: string | null;
        };
      } | null,
      { merge: false }
    >();

  if (error) throw new Error(`Lecture du cadeau impossible : ${error.message}`);
  if (!data) return null;

  return {
    ticketId: data.id,
    recipientName: data.gift_recipient_name,
    message: data.orders.gift_message,
    // Le prénom suffit à dire de qui vient le cadeau ; le nom complet
    // d'un acheteur n'a pas à voyager dans un lien qu'on fait suivre.
    fromName: data.profiles?.full_name?.trim().split(" ")[0] ?? null,
    claimed: data.claimed_at !== null,
    status: data.status,
    event: {
      slug: data.events.slug,
      title: data.events.title,
      city: data.events.city,
      venue: data.events.venue,
      startsAt: data.events.starts_at,
      glyph: data.events.glyph,
      gradient: data.events.gradient,
      posterPath: data.events.poster_path,
    },
    ticketTypeNameFr: data.ticket_types.name_fr,
    ticketTypeNameEn: data.ticket_types.name_en,
  };
}

export type OrderGift = {
  ticketId: string;
  claimCode: string;
  recipientName: string | null;
  claimed: boolean;
  eventTitle: string;
};

/**
 * Les cadeaux d'une commande, pour l'écran de confirmation.
 *
 * Lecture en service_role : l'appelant a déjà prouvé que la commande est
 * la sienne (getOrderForUser), et c'est le seul moment où l'acheteur a
 * besoin des liens tous ensemble — une place offerte à deux personnes
 * fait deux liens à envoyer.
 */
export async function listOrderGifts(orderId: string): Promise<OrderGift[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tickets")
    .select(
      "id, gift_claim_code, gift_recipient_name, claimed_at, events!inner ( title )"
    )
    .eq("order_id", orderId)
    .not("gift_claim_code", "is", null)
    .order("created_at")
    .overrideTypes<
      {
        id: string;
        gift_claim_code: string;
        gift_recipient_name: string | null;
        claimed_at: string | null;
        events: { title: string };
      }[],
      { merge: false }
    >();

  if (error) throw new Error(`Lecture des cadeaux impossible : ${error.message}`);

  return (data ?? []).map((row) => ({
    ticketId: row.id,
    claimCode: row.gift_claim_code,
    recipientName: row.gift_recipient_name,
    claimed: row.claimed_at !== null,
    eventTitle: row.events.title,
  }));
}

/** Motifs de refus renvoyés par spot.claim_gift_ticket. */
export type GiftClaimError =
  | "GIFT_NOT_FOUND"
  | "GIFT_ALREADY_CLAIMED"
  | "GIFT_NOT_VALID"
  | "GIFT_FAILED";

export type GiftClaimResult =
  | { ok: true; ticketId: string }
  | { ok: false; reason: GiftClaimError };

/**
 * Fait passer le billet au nom de celui qui réclame.
 *
 * L'écriture est faite par la fonction en base, sous verrou : deux
 * ouvertures simultanées du même lien ne peuvent pas donner deux
 * porteurs. Le motif d'échec revient en code, pas en phrase — c'est
 * l'écran qui le traduit.
 */
export async function claimGift(
  claimCode: string,
  userId: string
): Promise<GiftClaimResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("claim_gift_ticket", {
    p_code: claimCode,
    p_user_id: userId,
  });

  if (error) {
    const known: GiftClaimError[] = [
      "GIFT_NOT_FOUND",
      "GIFT_ALREADY_CLAIMED",
      "GIFT_NOT_VALID",
    ];
    const reason = known.find((code) => error.message.includes(code));
    if (!reason) console.error("[cadeau] réclamation échouée", error);
    return { ok: false, reason: reason ?? "GIFT_FAILED" };
  }

  return { ok: true, ticketId: data as unknown as string };
}
