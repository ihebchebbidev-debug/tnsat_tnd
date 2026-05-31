## Objectif

Séparer dans le dashboard **revendeur** les commandes selon le `sale_type` du service :

- **Stock** (livraison instantanée) → tout se passe **à l'intérieur de la fiche service** (3 onglets : Acheter / Mon historique / Mes resets).
- **Command** (fulfillment manuel) → reste dans la page **« Mes commandes »** classique (avec notifications & réponses admin).
- **Aucun** point d'entrée global vers l'historique stock — accès uniquement via la fiche service.

Scope : **Revendeur uniquement**. Client et Admin restent inchangés.

---

## Changements

### 1. Nouvelle route `/reseller/service/:id`
Créer une page dédiée revendeur (et non modifier `/service/:id` qui reste publique pour la landing).

Structure :
- En-tête : image + nom + prix (avec prix custom revendeur si applicable) + crédits restants.
- 3 onglets via shadcn `Tabs` :
  1. **Acheter** — formulaire achat (quantité, note) → réutilise `apiCreateOrder` + dialog credentials. Stock affiché.
  2. **Mon historique** — liste des `orders` du revendeur filtrés sur `service_id === :id`. Pour chaque ligne : date, quantité, crédits, statut, bouton « Voir codes ».
  3. **Mes resets** — liste des resets demandés pour ce service (filtrés via `apiGetOrderResponses` ou notifications liées au `service_id`) + formulaire de demande de reset (réutilise le flow `submitResetRequest` existant). Les **réponses admin** (codes envoyés en notification) sont affichées ici sous forme de timeline.

Tous les data fetchs filtrent par `service_id` côté client à partir des données déjà chargées dans le dashboard parent (ou rechargent localement).

### 2. Card service (onglet « Services » du dashboard)
Le bouton « Acheter » devient un lien vers `/reseller/service/:id` au lieu d'ouvrir le dialog d'achat directement. Les badges stock/sale_type restent visibles.

### 3. Onglet « Mes commandes »
Filtre dur : `orders.filter(o => services.find(s => s.id === o.service_id)?.sale_type === "command")`.
- Les commandes stock disparaissent complètement de cette liste.
- Conserve : statut, réponse admin, dialog de réponse, notifications liées.

### 4. Onglet « Codes de reset » → SUPPRIMÉ
- Le tab `resetCodes` est retiré du `setActiveTab` et de la barre d'onglets.
- Le state `resetProducts`, `rpTarget`, `resetSubmitting`, etc. est déplacé dans la nouvelle page service (ou un hook partagé `useResetRequests(serviceId)`).
- Les notifications de type "réponse à demande de reset" restent visibles dans l'onglet Notifications, mais ouvrent désormais la fiche service correspondante (tab Mes resets).

### 5. Onglet « Notifications »
Inchangé fonctionnellement. Quand on clique une notif liée à une commande **stock** → redirige vers `/reseller/service/:id` (tab historique ou resets selon le type). Pour une commande **command** → comportement actuel (dialog de réponse).

---

## Détails techniques

```text
src/pages/
  ResellerDashboard.tsx        (modifié : retire tab resetCodes, filtre orders, lien vers /reseller/service/:id)
  ResellerServiceDetail.tsx    (NOUVEAU : 3 onglets)

src/App.tsx
  + Route path="/reseller/service/:id" → ResellerServiceDetail

src/utils/
  resetRequests.ts             (NOUVEAU : extraire logique reset partagée)
```

**Filtrage stock vs command** :
```ts
const isStock = (orderOrService) => 
  services.find(s => s.id === (orderOrService.service_id ?? orderOrService.id))?.sale_type === "stock";

const commandOrders = orders.filter(o => !isStock(o));
const stockOrdersForService = (sid) => orders.filter(o => o.service_id === sid);
```

**Resets pour un service donné** : on identifie une demande de reset par son lien à un order `service_id` + type de notification. Si le PHP n'expose pas `service_id` dans `apiGetResetRequests`, on join côté client via `order_id → order.service_id`.

**Auth guard** : `ResellerServiceDetail` lit `getAuth()`, redirige `/login` si pas revendeur.

**i18n** : ajouter clés FR/EN/AR : `tabBuy`, `tabMyHistory`, `tabMyResets`, `noPurchaseYet`, `noResetYet`, `requestReset`, `adminResponse`.

---

## Ordre d'implémentation

1. Créer `ResellerServiceDetail.tsx` (squelette + 3 onglets statiques).
2. Câbler tab « Acheter » (déplacer le dialog d'achat existant).
3. Câbler tab « Mon historique » (filtre + table).
4. Câbler tab « Mes resets » (déplacer le flow reset existant).
5. Ajouter route dans `App.tsx` + clés i18n.
6. Modifier `ResellerDashboard.tsx` : lien vers la fiche, retirer tab resetCodes, filtrer commandes.
7. Ajuster onglet Notifications pour rediriger vers la fiche service quand pertinent.
8. Vérifier visuellement : achat stock, achat command, demande reset, réception réponse admin.

## Hors scope (à confirmer plus tard)

- Pas de refonte de la fiche publique `/service/:id` (reste pour la landing).
- Pas de changement côté Client ni Admin.
- Pas de modification du backend PHP (toute la logique se fait avec les endpoints existants).
- Pas d'ajout du badge « stock épuisé » si pas déjà présent (à voir).
