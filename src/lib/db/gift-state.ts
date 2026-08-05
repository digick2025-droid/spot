import type { GiftClaimError } from "./gifts";

/**
 * État du formulaire de réclamation.
 *
 * Hors du fichier « use server » : celui-ci ne peut exporter que des
 * fonctions asynchrones. L'erreur voyage en code — c'est l'écran qui la
 * traduit, en français comme en anglais.
 */
export type GiftState = { error?: GiftClaimError };

export const initialGiftState: GiftState = {};
