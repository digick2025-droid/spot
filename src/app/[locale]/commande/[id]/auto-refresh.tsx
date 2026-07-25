"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/**
 * Rafraîchit la page tant que la commande est en attente.
 *
 * router.refresh() rejoue le rendu serveur sans recharger la page ni
 * perdre l'état : le statut apparaît dès que le webhook a fait son
 * travail, sans que l'utilisateur ait à faire quoi que ce soit.
 */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
