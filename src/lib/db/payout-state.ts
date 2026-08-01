/**
 * États des formulaires de versement.
 *
 * Hors de payout-actions.ts : un fichier « use server » ne peut exporter
 * que des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type PayoutFormState = { error?: string; notice?: string };

export const initialPayoutState: PayoutFormState = {};

/**
 * Cause d'un versement échoué, inscrite dans payouts.failure_note puis
 * recopiée dans la notification du creator par fail_payout.
 *
 * Un code, pas une phrase : la note est lue par le creator autant que
 * par l'organisateur, dans deux langues, et le message de l'agrégateur
 * ne sait dire ni l'une ni l'autre — « Reversement Campay refusé (HTTP
 * 502) » nomme un prestataire et un incident d'infrastructure à qui
 * attend son argent. Le détail reste dans les journaux, avec la pile.
 *
 * Les deux codes disent ce que chaque appelant sait vraiment :
 * l'agrégateur a refusé la demande (webhook), ou la demande n'est pas
 * partie (action). L'action ne peut pas trancher davantage — elle n'a
 * pas eu de réponse à interpréter.
 */
export const PAYOUT_FAILURE_CODES = ["request_failed", "operator_refused"] as const;

export type PayoutFailureCode = (typeof PAYOUT_FAILURE_CODES)[number];

/**
 * Reconnaît une note codée.
 *
 * Les versements antérieurs à ce codage portent une phrase libre : elle
 * est rendue telle quelle plutôt que masquée, le temps qu'ils sortent
 * de l'historique.
 */
export function payoutFailureCode(note: string): PayoutFailureCode | null {
  return (PAYOUT_FAILURE_CODES as readonly string[]).includes(note)
    ? (note as PayoutFailureCode)
    : null;
}

/** Note d'échec telle qu'on la montre — traduite si elle est codée. */
export function payoutFailureLabel(
  note: string,
  t: (key: string) => string
): string {
  const code = payoutFailureCode(note);
  return code ? t(`payoutFailureNote.${code}`) : note;
}
