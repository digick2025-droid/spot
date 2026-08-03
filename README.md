# SP●T

Plateforme camerounaise de découverte d'événements et de billetterie — mobile-first, bilingue FR/EN, paiement Mobile Money (MTN MoMo & Orange Money), monnaie FCFA (XAF).

**4 espaces :** Participant (PWA mobile) · Organisateur (dashboard clair) · Creator/Influenceur · Admin.

La maquette visuelle de référence est `SPOT_Prototype__autonome_.html` à la racine.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (PostgreSQL + Auth + Storage + RLS) — projet partagé `digickos`, tables SPOT dans le schéma Postgres dédié **`spot`**
- **next-intl** — bilingue FR (défaut, `/`) / EN (`/en`)
- **Vercel** — hébergement
- **Campay** (Phase 1) — agrégateur Mobile Money, collection + disbursement, isolé derrière une interface `PaymentProvider`

## Design system

| Élément | Valeur |
|---|---|
| Fond sombre | `#0B0B0F` (`ink`) · cartes `#18181B` (`card`) |
| Orange marque | `#FF6B35` (`brand`) |
| Violet accent | `#8B5CF6` (`accent`) |
| Texte gris | `#A1A1AA` (`mist`) · `#71717A` (`smoke`) |
| Thème clair (Organisateur/Admin) | `#FFFFFF` / `#FAFAFA` (`paper`) |
| Titres | Manrope 800 (`font-display`) |
| Corps | Inter (`font-sans`) |

Les tokens sont déclarés dans `src/app/globals.css` (`@theme` Tailwind v4).

## Installation

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

Voir `.env.example`. Aucun secret n'est commité ; les clés `NEXT_PUBLIC_*` sont publiques (publishable), les clés secrètes (Phase 1+) restent côté serveur.

## Structure

```
messages/            dictionnaires FR/EN (next-intl)
src/app/[locale]/    pages (routing i18n : / = FR, /en = EN)
src/i18n/            routing, request config, navigation next-intl
src/lib/supabase/    clients browser + serveur (@supabase/ssr, schéma « spot »)
src/proxy.ts         middleware de détection de locale
```

## Déploiement

Déployé sur Vercel (team `digick`, projet `spot`) — https://spot-gamma-azure.vercel.app, dépôt GitHub connecté, chaque push sur `main` déclenche un build de production.

Variables d'environnement à configurer dans le dashboard Vercel, sur les trois environnements : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, plus les quatre `CAMPAY_*` quand `PAYMENT_PROVIDER=campay`. La liste fait foi dans `.env.example`.

Un build sans ces valeurs **réussit quand même** : aucune page n'est prérendue, donc l'absence de clés Supabase ne se voit qu'à la première requête, sous forme de 500. Un déploiement vert ne prouve donc rien — vérifier une page.

```bash
npm run build   # vérification locale avant déploiement
```

## Plan par phases

- ✅ **Phase 0 — Fondations** : scaffold, design system, i18n, Supabase, déploiement
- ✅ **Phase 1 — MVP cœur** : auth OTP, CRUD événements, découverte, paiement Mobile Money de bout en bout, billet QR, scan à l'entrée
- ✅ **Phase 2 — SPOT PASS + Affiliation** : points/niveaux/badges, campagnes creators, liens de promo, commissions figées à l'encaissement et versées par Mobile Money
- ✅ **Phase 3 — Admin + PWA** : console d'administration en lecture seule (sept onglets, lus via des fonctions `spot.admin_*` qui portent leur propre garde), manifeste, icônes générées au build, invitation à installer sur l'écran d'accueil

Règle d'or : pas de phase suivante tant que la précédente n'est pas testée et déployée.
