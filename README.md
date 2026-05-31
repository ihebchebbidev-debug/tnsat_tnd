# TN SAT — Plateforme de vente IPTV & deeds
f
## PrAésentationo
de
TN SAT est une plateforme de gestion et de vente de services IPTV et streaming. Elle permlet de gérer des clients, des revendeurs et des commandes via un système de **crédits** interne.
l## Architecturea
e
kk- **Backend** : PHP (API REST) avec MySQL
- **Hébergement** : Vercel (frontend) + serveur PHP (backend)

## Système de crédits

Toute la plateforme fonctionne avec des **crédits** :

- Les clients et revendeurs achètent des produits avec des crédits
- L'admin ajoute des crédits manuellement (avec note optionnelle) après paiement réel
- Les revendeurs peuvent aussi recharger via des codes de recharge
- Chaque mouvement de crédits est tracé dans l'historique des transactions

## Types d'utilisateurs

| Rôle | Accès |
|------|-------|
| **Admin** | Gestion complète : produits, clients, revendeurs, commandes, réclamations, clés produit, paramètres |
| **Revendeur** | Achat de produits, gestion de sous-revendeurs (si autorisé), recharge par code |
| **Client** | Achat de produits, consultation des commandes et identifiants, réclamations |

## Fonctionnalités principales

- 📦 **Produits** — Catégorisés, avec prix en crédits, spécifications, caractéristiques
- 🔑 **Clés produit** — Livraison automatique par clés pré-chargées (import en lot CSV)
- 📝 **Commandes** — Cycle complet : en attente → livrée → contestée → résolue / annulée
- 💰 **Crédits** — Ajout/retrait avec note, historique complet, codes de recharge
- 🏪 **Revendeurs** — Multi-niveaux, pays, sous-revendeurs, activation/désactivation
- 👥 **Clients** — CRUD, actions en lot, panel détail
- 📊 **Analytics** — Graphiques de ventes, produits populaires
- 🔔 **Notifications** — Temps réel pour commandes et réclamations
- 📄 **Documentation intégrée** — Guide admin complet dans le dashboard

## Lancer le projet

```bash
npm install
npm run dev
```

## Structure

```
src/
├── pages/          # Pages principales (Landing, Login, AdminDashboard, etc.)
├── components/     # Composants UI réutilisables
├── store/          # State management (auth, lang)
├── utils/          # API client, traductions, helpers
└── hooks/          # Custom hooks

php/
├── api/            # Endpoints REST (auth, clients, orders, etc.)
├── migrations/     # Scripts de migration SQL
├── config.php      # Configuration DB
└── schema.sql      # Schéma initial
```
