import type { ScanOutcome } from "./scan";

/**
 * État de la console de scan.
 *
 * Hors de scan-actions.ts : un fichier « use server » ne peut exporter que
 * des fonctions asynchrones (voir src/lib/auth/state.ts).
 */
export type ScanState = {
  outcome: ScanOutcome | null;
  message: string;
  detail: string | null;
  /** Horodatage pour forcer le rendu même sur deux résultats identiques. */
  at: number;
};

export const initialScanState: ScanState = {
  outcome: null,
  message: "",
  detail: null,
  at: 0,
};
