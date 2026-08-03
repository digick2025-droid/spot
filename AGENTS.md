<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SPOT — Conventions du projet

- **Produit** : plateforme camerounaise d'événements + billetterie. Marché : Douala/Yaoundé, FCFA (XAF), Mobile Money (MTN MoMo & Orange Money), bilingue FR (défaut) / EN.
- **Maquette de référence** : `SPOT_Prototype__autonome_.html` à la racine (bundle encodé — le HTML réel est dans la balise `<script type="__bundler/template">`, à parser en JSON). Respecter écrans, couleurs, libellés ; ne jamais copier son code tel quel.
- **Base de données** : projet Supabase partagé `digickos` (`kkvmgwmkwgqmqueycbqx`, eu-west-2). Les tables SPOT vivent EXCLUSIVEMENT dans le schéma Postgres `spot` — ne jamais toucher au schéma `public` (il appartient à une autre app). RLS obligatoire sur toute nouvelle table.
- **Migrations** : appliquer via MCP Supabase (`apply_migration`) ou le dashboard, JAMAIS `supabase db push`. `schema_migrations` est commune au projet partagé : 14 migrations de l'autre app y sont entrelacées avec les nôtres, sans fichier dans ce dépôt, et la CLI proposerait d'agir dessus. Après chaque `apply_migration`, créer le fichier dans `supabase/migrations/` avec **la version renvoyée par la base** (`list_migrations`), pas un horodatage inventé — sinon dépôt et base redivergent.
- **i18n** : next-intl, messages dans `messages/{fr,en}.json`. Namespace `app` = libellés extraits de la maquette (94 clés). `/` = FR, `/en` = EN (`localePrefix: "as-needed"`).
- **Design tokens** : définis en `@theme` dans `src/app/globals.css` (Tailwind v4) — `ink #0B0B0F`, `card #18181B`, `brand #FF6B35`, `accent #8B5CF6`, `mist/smoke` gris, `paper` pour le thème clair Organisateur/Admin. Titres `font-display` (Manrope 800), corps `font-sans` (Inter).
- **Paiement (Phase 1)** : agrégateur Campay derrière une interface `PaymentProvider` (collection + disbursement). Jamais de billet émis avant le webhook `paid`. Webhooks idempotents et signés.
- **Secrets** : uniquement en `.env.local` (jamais commité). `.env.example` tenu à jour.
- **Phases** : Phase 0 fondations ✅ → Phase 1 MVP (auth OTP, événements, paiement, billets QR, scan) → Phase 2 SPOT PASS + affiliation → Phase 3 Admin/PWA. Ne pas commencer une phase sans validation utilisateur de la précédente.
