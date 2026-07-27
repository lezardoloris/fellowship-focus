# Positionnement, sur données réelles (DataForSEO, 27/07/2026)

*Volumes et CPC tirés de l'API Google Ads via DataForSEO. Plus d'estimation : ce sont les chiffres qui décideront de tes enchères.*

---

## 1. Les deux grappes, et l'inversion qu'elles révèlent

### Grappe « bloqueur » : trafic abondant et bon marché

| Requête | Volume/mois (US) | CPC | Concurrence |
|---|---|---|---|
| site blocker chrome extension | **8 100** | **1,94 $** | **4/100** |
| focus app | 5 400 | 4,79 $ | 11/100 |
| website blocker | 5 400 | 2,78 $ | 38/100 |
| cold turkey blocker | 4 400 | 4,16 $ | 17/100 |
| freedom app | 3 600 | 1,32 $ | 26/100 |
| **Cumul** | **~27 000** | **~2-5 $** | |

### Grappe « argent » : trafic rare et hors de prix

| Requête | Volume/mois (US) | CPC | Concurrence |
|---|---|---|---|
| time tracking software | 14 800 | **62,44 $** | 8/100 |
| automatic time tracking | 720 | 24,83 $ | 19/100 |
| productivity tracker | 480 | 26,03 $ | 83/100 |
| billable hours tracker | 260 | 19,87 $ | 55/100 |
| harvest alternative | **90** | **64,71 $** | 58/100 |

**L'inversion** : le trafic est bon marché exactement là où le produit ne se monétise pas, et hors de prix exactement là où il se monétise. Ce n'est pas un hasard, c'est un marché efficient : personne n'enchérit à 2 $ sur « site blocker » (indice de concurrence 4) parce que **personne n'y gagne d'argent**.

---

## 2. La règle qui tranche tout

Avec les hypothèses standard (5 % visiteur→essai, 25 % essai→payant, soit 1,25 % du clic au paiement) et un churn SMB réaliste de 4 %/mois :

```
CAC        = CPC × 80
LTV 12 mois = prix × 9,68
Ratio ≥ 3  ⟹  prix mensuel ≥ CPC × 24,8
```

> **Ton prix mensuel doit valoir environ 25 fois ton CPC.**

Application directe :

| CPC | Prix mensuel minimum requis |
|---|---|
| 1,94 $ (site blocker) | **48 $/mois** |
| 2,78 $ (website blocker) | **69 $/mois** |
| 4,79 $ (focus app) | **119 $/mois** |
| 62,44 $ (time tracking software) | **1 549 $/mois** |

---

## 3. La conclusion, et elle est inconfortable

**Cette catégorie ne s'achète pas en Google Ads à un prix solo.**

- Le trafic bloqueur à 2,78 $ exige **69 $/mois**. Cold Turkey vend 39 $ **une seule fois**. L'écart est d'un facteur 20.
- Le trafic time tracking à 62 $ exige **1 549 $/mois**. Memtime vend 12-15 €.

**Ton avantage Google Ads ne vaut rien sur ce marché.** C'est le résultat le plus utile de tout l'exercice, et c'est celui que je n'attendais pas. Bien acheter du search ne sert à rien quand aucun prix soutenable ne porte le CPC.

Corollaire : ma propre hypothèse « alternative à X » est morte aussi. **« harvest alternative » fait 90 recherches par mois à 64,71 $ le clic.** La fenêtre existe, mais elle est minuscule et déjà chère.

### La France est un cimetière

| Requête | Volume/mois |
|---|---|
| bloqueur de site internet | 20 |
| logiciel suivi du temps | 10 |
| application concentration | 90 |
| logiciel de gestion du temps freelance | **aucune donnée** |
| bloquer les sites distrayants | **aucune donnée** |

Pas de marché francophone sur cette catégorie. C'est les États-Unis ou rien.

---

## 4. Preuve que le rapport Gemini était fabriqué

Il annonçait **8 000 recherches/mois** sur « property inventory software » et en faisait son marché n°2.

**Chiffre réel : 50 recherches/mois.** Un facteur **160**.

Vérifié aussi : « property inspection software » 140/mois. Tout ce marché tient dans une poignée de recherches. Ne rouvre pas ce rapport.

---

## 5. Les trois positionnements possibles, avec ce que chacun coûte

### A · Garder le produit, changer de canal · **recommandé**
Le search payant est fermé, mais **le Chrome Web Store est lui-même un moteur de recherche**, et « site blocker chrome extension » à 8 100/mois prouve que la demande s'exprime aussi là-bas. L'optimisation de fiche y est **gratuite**.

- Canaux : fiche Chrome Web Store, SEO sur les requêtes bloqueur (concurrence 4/100, donc facile), et ton audience X existante.
- Prix : peu importe le CPC puisqu'on n'achète pas de clic.
- Ce que ça coûte : **ton avantage Google Ads ne sert pas.** Tu joues sans ton meilleur atout.

### B · Garder le canal, changer de marché
Appliquer la règle des 25× pour chercher un marché où le prix dépasse 50 $/mois avec un CPC sous 2 $. Ça existe, mais pas dans la productivité.

- Ce que ça coûte : **tu abandonnes tout le code écrit.** Le blocage multi-couches, le tracker, la vue argent, tout devient sans emploi.

### C · Monter le prix jusqu'à 69 $/mois et acheter le trafic bloqueur
Techniquement cohérent avec la règle. Mais personne ne paie 69 $/mois pour bloquer des sites, et Cold Turkey à 39 $ une fois est à un clic.

- Ce que ça coûte : **invendable**, sauf à servir un acheteur professionnel avec une raison de payer ce prix (cabinet, conformité, équipe).

---

## 6. Ce que je ferais

**A pour ce produit, B pour ton temps d'acquisition.**

Fellowship Focus se distribue en gratuit via le Chrome Web Store et le SEO, où la concurrence est à 4 sur 100 et le trafic ne se paie pas. Il n'a jamais besoin d'être un business à 200 k€ ; il peut être ton outil, ta vitrine et ta preuve.

Et si tu veux appliquer ton avantage Google Ads, **il faut un autre marché**, choisi avec la règle des 25×, c'est-à-dire un prix supérieur à 50 $/mois sur un CPC inférieur à 2 $. C'est un critère chiffré et vérifiable en cinq minutes avec l'outil qu'on vient d'utiliser, sur n'importe quel candidat.

**Le vrai livrable de cette séance n'est pas un marché, c'est ce filtre.** Il aurait éliminé les trois « gagnants » de Gemini avant même de les étudier.
