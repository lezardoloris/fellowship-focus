# Moats, pricing, mots-clés associés

*27/07/2026. Toutes les données via l'API Google Ads (DataForSEO). Corrige la note d'hier sur le conquesting.*

---

## ⚠️ Correction : « conquesting de marque » recouvre deux choses opposées

J'ai recommandé hier d'acheter la marque des concurrents en m'appuyant sur « hubstaff » à 2,61 $. Les données complètes montrent que **les deux familles de requêtes de marque n'ont rien à voir**.

| Type | Exemple | Volume | CPC | Ce que ça vaut |
|---|---|---|---|---|
| **Marque nue** | hubstaff | **18 100** | **2,61 $** | Pas cher car **navigationnel** : la majorité cherche sa page de connexion |
| **Marque + alternative** | hubstaff alternative | **70** | **75,75 $** | Intention d'achat pure, donc cher et minuscule |

**C'est pour ça que la marque nue est bon marché : ce n'est pas une aubaine, c'est du trafic de clients existants.**

Correction du calcul : je supposais 0,5 % de conversion sur ce trafic. Si 85 % des visiteurs cherchent leur login, la conversion réelle est plutôt **0,1 à 0,2 %**.

```
CPC 2,61 $ · conversion 0,15 % → CAC = 1 740 $
LTV (15 sièges × 10 $ / churn 2 %) = 7 500 $
Ratio = 4,3
```

**Ça tient encore**, parce que le CPC est assez bas pour absorber une conversion médiocre. Mais c'est 4,3 et non 14,4. Et le « X alternative », que je citais comme la porte d'entrée, est en réalité **fermé** : 70 recherches à 75,75 $.

---

## 1. Les mots-clés, classés par palier d'intention

### Palier A · Marques nues · volume, pas cher, intention faible

| Requête | Volume/mois | CPC | Concurrence |
|---|---|---|---|
| hubstaff | 18 100 | **2,61 $** | 47 |
| activtrak | 8 100 | 21,76 $ | 46 |
| teramind | 6 600 | 21,01 $ | 54 |
| time doctor | 5 400 | 8,03 $ | 57 |
| desktime | 1 000 | 4,74 $ | 88 |
| **Total** | **~39 200** | | |

**Hubstaff et Time Doctor sont les deux seuls exploitables** (2,61 $ et 8,03 $). ActivTrak et Teramind à 21 $ font tripler le CAC pour un quart du volume.

### Palier B · Marque + alternative · intention forte, marché fermé

| Requête | Volume | CPC |
|---|---|---|
| teramind alternative | 40 | 89,71 $ |
| time doctor alternative | 70 | 80,54 $ |
| hubstaff alternative | 70 | 75,75 $ |
| activtrak alternative | 50 | 59,52 $ |

**220 recherches par mois au total, à 75 $ le clic.** À écarter, sauf en SEO où le clic est gratuit.

### Palier C · Générique · fermé

| Requête | Volume | CPC |
|---|---|---|
| employee monitoring software | 1 600 | 67,97 $ |
| workforce analytics software | 590 | 46,41 $ |
| insider threat detection software | 210 | 40,91 $ |
| remote employee monitoring | 140 | **123,04 $** |

### Palier D · Conformité · **aucun volume**

| Requête | Volume |
|---|---|
| gdpr employee monitoring | 40 |
| is employee monitoring legal | 10 |

**Constat important** : la conformité **ne s'achète pas en acquisition**, il n'y a personne à capter. C'est un moat de **conversion et de rétention**, pas de trafic. Je l'avais présenté hier comme un axe d'acquisition, c'était faux.

---

## 2. Les moats, avec leur pricing et leurs mots-clés

| # | Moat | Type | Solidité | Modèle de prix associé | Mots-clés qui le servent |
|---|---|---|---|---|---|
| 1 | **Historique de données** | structurel | **forte** | Palier de rétention : 3 mois inclus, 12 mois +40 %, illimité +80 % | aucun (invisible à l'achat, agit sur le churn) |
| 2 | **Conformité UE / CSE** | réglementaire | **forte** | Add-on « Conformité » +30 à 50 %, ou inclus dans l'offre européenne | palier D, **volume nul** → SEO et contenu, pas d'enchère |
| 3 | **Canal MSP / revendeur** | distribution | **très forte** | 20-30 % reversés, prix catalogue conservé | « msp software bundle », à explorer |
| 4 | **Intégration paie / SIRH** | technique | moyenne | Add-on ou palier supérieur | « [payroll] integration », longue traîne |
| 5 | **Forfait entreprise** (contre le par-siège) | positionnement | **faible** | 79-199 $/mois illimité | palier A et B : c'est l'argument de la page de comparaison |
| 6 | **Mode agrégé non nominatif** | produit | faible | inclus, argument de vente | palier D |
| 7 | Prix bas | aucun | **nul** | — | — |

---

## 3. La grille de prix que je recommande

| Offre | Prix | Cible | Moat qu'elle active |
|---|---|---|---|
| **Team** | **8 $/siège/mois** | 5-20 sièges, libre-service | sous Hubstaff (7-12 $), lisible |
| **Flat** | **99 $/mois illimité** | 15-40 sièges | #5, l'argument anti-par-siège |
| **Compliance** | **+49 $/mois** | Europe, toute taille | #2, marge la plus élevée |
| Rétention longue | +40 % sur l'offre | tous | #1, augmente le coût de sortie |

**Pourquoi 8 $ et pas 5 $** : à 5 $ le compte type tombe à 75 $/mois, la LTV à 3 750 $, et le ratio à 2,2 avec le CAC de 1 740 $. **8 $ est le plancher qui garde le ratio au-dessus de 4.** Le prix n'est pas un choix de positionnement ici, c'est une contrainte arithmétique.

**Pourquoi le forfait à 99 $** : il capte les équipes de 15 à 40 personnes qui refusent de facturer au siège, et il fait monter l'ARPU sur les gros comptes sans négociation. Au-dessus de 12 sièges, il est moins cher pour le client **et** plus rentable pour toi.

---

## 4. Le plan d'achat qui découle des chiffres

**Ce qu'on achète** : uniquement `hubstaff` (2,61 $) et `time doctor` (8,03 $). 23 500 recherches par mois cumulées.

**Ce qu'on n'achète jamais** : le palier B (75 $ le clic pour 220 recherches), le palier C (68 à 123 $), et le palier D (pas de volume).

**Ce qu'on travaille en SEO**, où le clic ne coûte rien : les paliers B et D. Une page « alternative à Hubstaff » et une page « surveillance des salariés et RGPD » ne coûtent que du temps, et ce sont exactement les deux requêtes à la plus forte intention.

**La conséquence stratégique** : ton avantage Google Ads sert sur **deux mots-clés**, pas sur un marché. Le reste de l'acquisition est du contenu. C'est moins glorieux que ce que je décrivais hier, et c'est ce que disent les chiffres.

---

## 5. Ce qui reste vrai après correction

- Le B2B garde le meilleur ratio de l'étude (**4,3**), parce que la LTV à 7 500 $ absorbe une conversion médiocre.
- Les deux moats qui tiennent restent **l'historique de données** et **la conformité européenne**, mais la conformité est un moat de rétention, pas d'acquisition.
- **8 $/siège est un plancher arithmétique**, pas une opinion.
- Et l'avertissement ne change pas : le produit rentable ici surveille des salariés. La version défendable est agrégée, non nominative, à rétention courte, et c'est aussi celle qui se vend le mieux en Europe.
