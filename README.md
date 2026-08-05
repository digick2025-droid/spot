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

**Concept directeur : l'événement comme un album.** L'affiche est carrée, comme une pochette ; l'organisateur tient le rôle de l'artiste ; le billet est ce qu'on possède. La signature visuelle est le **halo** — chaque événement diffuse son propre dégradé derrière sa carte, sa fiche et sa vignette de partage, allumé en permanence (sur téléphone il n'y a pas de survol, et c'est la plateforme principale).

| Élément | Valeur |
|---|---|
| Fond sombre | `#08080B` (`ink`) · cartes posées `#101014` (`surface`) · cartes levées, feuilles, champs `#191920` (`surface-high`) · coque `#0C0C11` (`shell`) |
| Orange marque | `#FF6B35` (`brand`) · clair `#FF9155` (`brand-bright`) · profond `#C2410C` (`brand-deep`) |
| Rose braise | `#F0286D` (`ember`) |
| Violet accent | `#8B5CF6` (`accent`) · profond `#4C1D95` (`accent-deep`) |
| Texte gris | `#A1A1AA` (`mist`) · `#71717A` (`smoke`) · `#E4E4E7` (`fog`) |
| Thème clair (Organisateur/Admin) | `#F6F6F8` (`paper`) · cartes `#FFFFFF` (`paper-card`) · filets `#E6E6EC` (`paper-line`) |
| Titres | Manrope 800 (`font-display`) |
| Corps | Inter (`font-sans`) |

Trois dégradés nommés, déclinaisons d'une même chaleur : **braise** (`grad-ember`, orange → rose → violet) est la signature, **or** (`grad-heat`) porte l'argent et les billets, **nuit** (`grad-night`) le SPOT PASS.

Les tokens sont déclarés dans `src/app/globals.css` (`@theme` Tailwind v4), les dégradés juste en dessous en variables `:root` — hors `@theme`, faute d'espace de noms Tailwind, ce qui les rend utilisables aussi bien en classe qu'en style inline. Les utilitaires de marque (`halo`, `glass`, `sheen`, `sheet`, `press`, `glow-brand`, `rise`) sont déclarés en `@utility` dans le même fichier : les réutiliser plutôt que réécrire des classes ad hoc.

**Icônes** — `lucide-react`, via le barrel de noms sémantiques `src/components/icons.ts`. Les emojis ne servent plus d'icônes d'interface ; ils restent du contenu (catégories, glyphes d'organisateurs venus de la base).

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
messages/                  dictionnaires FR/EN (next-intl)
src/app/[locale]/(site)/   vitrine publique : /, /organisateurs, /creators
src/app/[locale]/(app)/    l'application : /accueil, /decouvrir, /billets…
src/components/site/       briques de la vitrine (en-tête, pied, démos)
src/i18n/                  routing, request config, navigation next-intl
src/lib/supabase/          clients browser + serveur (@supabase/ssr, schéma « spot »)
src/proxy.ts               middleware de détection de locale
```

Les deux groupes de routes ont chacun leur coque : `(site)` porte l'en-tête et le pied de page de la vitrine, `(app)` la barre d'onglets du produit. Chacun installe son propre `NextIntlClientProvider`, pour n'envoyer au client que les messages qui le concernent.

**La racine `/` sert la vitrine**, pas l'application : l'accueil personnalisé vit à `/accueil` (`/en/accueil` en anglais), qui est aussi le `start_url` du manifeste PWA et la destination après connexion.

## Images

**Affiches d'événement** — bucket Storage `spot-posters`, public en lecture (une affiche est une image de promotion), écriture sous RLS : le chemin est `<organizer_id>/<uuid>.<ext>` et une policy vérifie que le premier segment appartient bien à l'appelant. L'événement n'en garde que le chemin, dans `spot.events.poster_path`. Sans affiche, le dégradé et l'emoji restent le repli — aucune fiche ancienne n'est cassée. Le rendu passe par `next/image` : l'hôte Supabase est déclaré dans `next.config.ts`.

**Vignettes de partage** — dessinées avec `ImageResponse`, comme les icônes : `src/app/opengraph-image.tsx` pour la marque, `…/evenements/[slug]/opengraph-image.tsx` pour chaque événement (titre, date, lieu, prix, et l'affiche en fond quand elle existe). Ces routes n'ont pas d'extension : elles sont **exclues du matcher de `src/proxy.ts`**, faute de quoi next-intl les préfixerait d'une locale et WhatsApp comme Facebook recevraient une redirection ou un 404. `NEXT_PUBLIC_SITE_URL` fixe la base des URL absolues.

## Billets offerts

Offrir n'est pas payer pour quelqu'un d'autre. Le billet **naît au nom de l'acheteur** et porte un code de réclamation : l'acheteur le voit dans ses billets, peut renvoyer le lien, et le garde si personne ne le réclame. Qui ouvre `/cadeau/<code>` et réclame en devient le porteur — l'écriture passe par `spot.claim_gift_ticket`, sous verrou, pour que deux ouvertures simultanées du même lien ne fassent pas deux porteurs.

Aucun e-mail n'est envoyé : la plateforme n'a pas d'expéditeur transactionnel, et ici un cadeau se transmet par WhatsApp. Le lien part donc par la feuille de partage du téléphone (`src/components/gift-share.tsx`), accompagné d'une phrase — reçu seul, un lien de cadeau ressemble à n'importe quel lien suspect et ne s'ouvre pas.

L'aperçu du cadeau se lit en `service_role` (le destinataire n'est pas encore porteur, donc la RLS ne lui montrerait rien), avec une sélection étroite : ni `secret`, ni code d'entrée, rien qui permettrait de fabriquer un QR à partir du seul lien. La page de connexion retient d'où l'on vient, et n'accepte que des chemins internes — `//ailleurs.example` ferait de notre connexion un tremplin.

## Déploiement

Déployé sur Vercel (team `digick`, projet `spot`) — https://spot-gamma-azure.vercel.app, dépôt GitHub connecté, chaque push sur `main` déclenche un build de production.

Variables d'environnement à configurer dans le dashboard Vercel, sur les trois environnements : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`, plus les quatre `CAMPAY_*` quand `PAYMENT_PROVIDER=campay`, et `NEXT_PUBLIC_SITE_URL` le jour où un domaine propre remplace l'adresse `.vercel.app`. La liste fait foi dans `.env.example`.

Un build sans ces valeurs **réussit quand même** : aucune page n'est prérendue, donc l'absence de clés Supabase ne se voit qu'à la première requête, sous forme de 500. Un déploiement vert ne prouve donc rien — vérifier une page.

```bash
npm run build   # vérification locale avant déploiement
```

## Plan par phases

- ✅ **Phase 0 — Fondations** : scaffold, design system, i18n, Supabase, déploiement
- ✅ **Phase 1 — MVP cœur** : auth OTP, CRUD événements, découverte, paiement Mobile Money de bout en bout, billet QR, scan à l'entrée
- ✅ **Phase 2 — SPOT PASS + Affiliation** : points/niveaux/badges, campagnes creators, liens de promo, commissions figées à l'encaissement et versées par Mobile Money
- ✅ **Phase 3 — Admin + PWA** : console d'administration en lecture seule (sept onglets, lus via des fonctions `spot.admin_*` qui portent leur propre garde), manifeste, icônes générées au build, invitation à installer sur l'écran d'accueil
- ✅ **Après la Phase 3 — vitrine, affiches, partage** : les trois pages publiques à la racine, les affiches d'événement dans Storage, les vignettes Open Graph et le bandeau d'installation — [`a1c1da0`](https://github.com/digick2025-droid/spot/commit/a1c1da0fd64253165169663d5a4bb6b2fa2c78f4) (2026-08-04)
- ✅ **Refonte visuelle** : l'album et le halo passés sur tous les écrans — public, créateurs, scanner, espace organisateur en papier, vitrine — puis la barre d'onglets qui suit le métier de la personne (cinq onglets au maximum) et les soirées passées qui se disent comme telles — de [`79d420e`](https://github.com/digick2025-droid/spot/commit/79d420e9ed307ed853183a651f95b14ddd40a158) à [`840720b`](https://github.com/digick2025-droid/spot/commit/840720b82bd277b677efc8445de595922003735c) (2026-08-04 → 2026-08-05)
- ✅ **Offrir une place** : l'achat pour quelqu'un d'autre, le billet gardé au nom de l'acheteur jusqu'à la réclamation, le lien transmis par la feuille de partage du téléphone — [`fdc1057`](https://github.com/digick2025-droid/spot/commit/fdc10578a02899d82426642c83627752f855f65b) (2026-08-05)

Règle d'or : pas de phase suivante tant que la précédente n'est pas testée et déployée.
