# Carte courte / moyenne / longue traîne, avec les vraies enchères

*27/07/2026. **Corrige deux erreurs de mes analyses précédentes.** Etienne avait raison de ne pas croire les CPC affichés.*

---

## 1. Mes deux erreurs

### Erreur 1 · J'ai utilisé le champ `cpc` de DataForSEO

Il **dépasse l'enchère haute de première page** dans presque tous les cas, ce qui est impossible : on ne peut pas payer en moyenne plus cher que le haut de la fourchette.

| Mot-clé | `cpc` affiché | Enchère basse **réelle** | Facteur |
|---|---|---|---|
| time tracking software | 62,44 $ | **14,51 $** | ×4,3 |
| employee monitoring software | 67,97 $ | **15,08 $** | ×4,5 |
| remote employee monitoring | 123,04 $ | **21,53 $** | ×5,7 |
| automated time tracking | 24,83 $ | **4,65 $** | ×5,3 |
| hubstaff | 2,61 $ | **0,80 $** | ×3,3 |

**La donnée exploitable est `low_top_of_page_bid`**, ce que paie un annonceur avec un bon Quality Score pour être en haut de page. C'est ton métier, donc c'est ce niveau-là qui te concerne, pas la moyenne du marché.

### Erreur 2 · J'ai regardé un vocabulaire trop étroit

Je n'ai cherché que « time tracking » et « employee monitoring ». **Le même acheteur cherche aussi « time clock », et c'est cinq à vingt fois moins cher.**

---

## 2. La carte complète, par longueur de requête

### Traîne courte (1-2 mots) · volume massif, intention diluée

| Mot-clé | Volume | Enchère basse | Note |
|---|---|---|---|
| time clock | 74 000 | 1,97 $ | beaucoup d'informationnel (calculatrices) |
| screen time | 49 500 | 0,62 $ | grand public / parental |
| time sheet | 14 800 | 2,90 $ | mixte |
| time tracker | 8 100 | 3,00 $ | **exploitable** |

### Traîne moyenne (3-4 mots) · **le cœur commercial**

| Mot-clé | Volume | Enchère basse | Enchère haute |
|---|---|---|---|
| **time clock app** | **4 400** | **3,42 $** | 26,27 $ |
| **employee time clock** | **3 600** | **5,42 $** | 34,54 $ |
| employee time tracking software | 2 900 | ~15 $ | 60,75 $ |
| time card app | 1 600 | 3,89 $ | 23,43 $ |
| **work hours tracker** | 1 600 | **2,55 $** | 14,22 $ |
| time clock software | 1 600 | 14,70 $ | 60,75 $ |
| free time clock app | 1 300 | 3,04 $ | 17,88 $ |
| employee time clock app | 880 | 5,62 $ | 39,10 $ |
| **automated time tracking software** | 720 | **4,65 $** | 25,62 $ |
| hours tracker app | 390 | **1,89 $** | 12,99 $ |
| punch clock app | 260 | 4,70 $ | 26,18 $ |

### Traîne longue (5+ mots) · rare et paradoxalement chère

| Mot-clé | Volume | Enchère basse |
|---|---|---|
| time clock app for small business | 390 | 11,79 $ |

**Contre-intuitif mais net : dans ce marché, la longue traîne est plus chère que la moyenne.** « for small business » signale un acheteur qualifié, donc tout le monde enchérit. La bonne affaire est dans la traîne **moyenne**, pas longue.

---

## 3. Le vocabulaire décide du prix, pas l'intention

Même acheteur, même produit, deux fois cinq fois le prix :

| Formulation | Volume | Enchère basse |
|---|---|---|
| employee **time clock** | 3 600 | **5,42 $** |
| employee **time tracking software** | 2 900 | ~15 $ |

**Trois fois moins cher pour la même personne.** Les éditeurs se battent sur le mot « software » parce que c'est celui de leurs pages produit. Le mot « clock » est celui de leurs clients.

---

## 4. L'économie recalculée

Base : compte de 15 sièges à 10 $ = 150 $/mois, churn 2 %, **LTV 7 500 $**.

| Mot-clé | Enchère basse | CAC (×80) | **Ratio** |
|---|---|---|---|
| work hours tracker | 2,55 $ | 204 $ | **37** |
| time clock app | 3,42 $ | 274 $ | **27** |
| automated time tracking | 4,65 $ | 372 $ | **20** |
| employee time clock | 5,42 $ | 434 $ | **17** |
| employee time tracking software | 15,08 $ | 1 206 $ | **6,2** |

**Tout passe. Le marché entier est achetable.**

---

## 5. Le vrai plafond, recalculé

**Base commerciale à intention B2B, enchère basse sous 6 $ :**

`time clock app` 4 400 + `employee time clock` 3 600 + `time card app` 1 600 + `work hours tracker` 1 600 + `free time clock app` 1 300 + `employee time clock app` 880 + `automated time tracking` 720 + `hours tracker app` 390 + `punch clock app` 260

> **≈ 14 750 recherches/mois à environ 4 $ d'enchère basse.**

Hypothèse prudente (8 % de clics compte tenu de la part d'impressions atteignable) :

```
14 750 × 8 %          = 1 180 clics/mois
1 180 × 4 $           = 4 720 $/mois de budget
1 180 × 1,25 %        = 14,7 clients/mois
14,7 × 150 $ de MRR   = +2 200 $ de MRR par mois
```

**Après 12 mois : environ 26 000 $ de MRR, soit 310 k$ d'ARR, pour 57 k$ dépensés.**

---

## 6. Ce que ça change par rapport à ce que je t'ai dit

| Ce que j'affirmais | La réalité |
|---|---|
| « Le marché n'est pas achetable » | **Faux.** Tout passe à l'enchère basse. |
| « Le search est un filet, pas un moteur » | **Faux.** ~15 clients/mois, 310 k$ d'ARR en un an. |
| « 3 clients par mois maximum » | **Faux d'un facteur 5.** |
| « La différenciation tient dans un seul mot-clé » | Vrai, mais elle n'est plus le sujet : le volume est ailleurs. |

**Ce qui reste vrai** : le générique pur (`time tracking software`, `employee monitoring software`) est le plus cher du marché, et il faut le laisser aux concurrents financés. Ce qui change, c'est qu'il existe tout un vocabulaire parallèle, aussi qualifié et trois à cinq fois moins cher.

---

## 7. La leçon méthodologique

Deux règles pour la suite, tirées de mes propres erreurs :

1. **Ne jamais utiliser un champ `cpc` agrégé.** Prendre `low_top_of_page_bid`, qui est ce que paie un bon annonceur.
2. **Toujours tester le vocabulaire du client, pas celui de l'éditeur.** L'éditeur dit « software », le client dit « app » ou « clock ». L'écart de prix entre les deux est le vrai gisement.
