/**
 * État du formulaire de connexion.
 *
 * Volontairement hors de actions.ts : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones, chaque export devenant un point
 * d'entrée appelable depuis le réseau. Une valeur constante n'a rien à
 * faire dans ce contrat.
 */
export type AuthState = {
  /** Étape affichée : saisie de l'e-mail, puis saisie du code reçu. */
  step: "email" | "code";
  email?: string;
  error?: string;
  notice?: string;
};

export const initialAuthState: AuthState = { step: "email" };
