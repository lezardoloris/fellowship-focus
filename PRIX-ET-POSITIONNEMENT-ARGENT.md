# Le prix change tout, et « où part la tune » différencie à moitié

*28/07/2026. Corrige l'hypothèse de prix qui plombait toutes mes conclusions.*

---

## 1. Mon erreur : j'ai figé le prix à 8 $

Tout mon raisonnement de la veille partait de 8 $/mois, aligné sur Clockify et Memtime. **C'était une hypothèse, pas une contrainte.** Et c'est elle qui rendait tous les volumes insuffisants.

Avec la formule `LTV = prix / churn` et un churn de 3 % :

| Prix mensuel | LTV | CAC max (ratio 3) | Ratio sur un clic à 3 $ |
|---|---|---|---|
| 8 $ | 267 $ | 89 $ | **1,1** ❌ |
| 15 $ | 500 $ | 167 $ | 2,1 ⚠️ |
| **30 $** | **1 000 $** | **333 $** | **4,2** ✅ |
| **50 $** | **1 667 $** | **555 $** | **7,0** ✅ |

**À 30 $, tout le marché redevient achetable.** Le clic à 3 $ donne un CAC de 240 $ contre une LTV de 1 000 $.

### Ce que ça donne en volume

Base « tracking » mesurée : **46 700 recherches/mois**.

```
46 700 × 10 % de clics   = 4 670 clics/mois
4 670 × 3 $              = 14 000 $/mois de budget
4 670 × 1,25 %           = 58 clients/mois
58 × 30 $                = +1 740 $ de MRR par mois
```

**Après 12 mois : ~21 000 $ de MRR, soit 250 k$ d'ARR.** C'est exactement ta cible de 10-20 k€/mois.

**Donc oui, c'est faisable. Le verrou n'était pas le marché, c'était le prix que je te prêtais.**

---

## 2. Le vrai risque, dit franchement

**Personne dans cette catégorie ne facture 30 $ à un indépendant.** Memtime 12-15 €, Harvest 12-14 $, Timing 9-16 $, Clockify gratuit. Tu créerais un palier de prix qui n'existe pas.

Ce n'est pas impossible, mais ça ne se fait qu'à une condition : **changer ce que tu vends**. Personne ne paie 30 $ pour du suivi du temps. Quelqu'un qui facture 80 €/h paie 30 $ pour récupérer deux heures oubliées par mois, soit 160 € : le retour est de 5 pour 1 et il se voit sur la première facture.

> **Le prix ne tient pas sur la feature, il tient sur la promesse.**

---

## 3. « Où part la tune » : différenciant à moitié, et il faut savoir de quelle moitié

### Ce qui n'est pas différenciant

Regarde la page de Clockify que tu m'as envoyée. Ils ont déjà :

> **Rates** — *See earnings, cost, and profit* · **Projects** — *Track project estimates and budget* · **Invoicing** — *Create invoices from billable time*

Harvest et Toggl aussi. **La couche argent existe partout.** Dire « on te montre où part ton argent » ne te distingue de personne.

### Ce qui l'est vraiment

Chez eux, la donnée argent existe **à condition que tu étiquettes ton temps toi-même** : choisir le client, choisir le projet, à chaque bloc. C'est le même défaut que le chrono à lancer, déplacé d'un cran.

**La différenciation, c'est l'attribution automatique** : le tracker déduit le client depuis le titre de la fenêtre (`Mocenza · Google Ads`, le nom du dépôt dans l'éditeur) sans que tu tagges quoi que ce soit.

C'est précisément ce que tu as construit cette semaine, entre le journal d'événements horodaté et les règles d'intention.

### Le problème, et il est connu

`project profitability software` fait **30 recherches par mois**. Cette différenciation **ne se cherche pas**.

**Mais à 30 $/mois, ça n'a plus d'importance.** Tu n'as plus besoin que ton moat soit ciblable : tu achètes le trafic générique bon marché (`time tracker` 3,00 $, `track my hours` 2,42 $) et tu convertis avec l'attribution automatique sur la page de destination. **C'est la LTV qui paie le clic générique, pas le mot-clé qui doit décrire ton moat.**

C'est la résolution de la contrainte que tu posais hier, et elle vient du prix.

---

## 4. Ce que ça implique concrètement

| Élément | Ce qu'il faut |
|---|---|
| **Prix** | 29 $/mois indépendant, 19 $/siège équipe |
| **Promesse** | « Les heures que tu as travaillées et jamais facturées » |
| **Preuve exigée** | montrer un montant en euros dès la première semaine d'essai |
| **Feature qui la porte** | attribution automatique client sans étiquetage |
| **Trafic acheté** | générique bon marché, pas les mots-clés du moat |
| **Ce qu'on ne vend plus** | le focus, le blocage, le score |

**Le blocage devient une fonctionnalité de rétention, plus jamais un argument de vente.** Il te fait ouvrir l'app tous les jours, ce qui alimente le tracker, ce qui rend le chiffre exact. Il ne se vend pas et il n'a pas à se vendre.

---

## 5. Ce qui reste à prouver, et c'est le seul vrai risque

**Est-ce que quelqu'un paie 29 $/mois ?** Tout le raisonnement en dépend, et personne ne le fait dans cette catégorie aujourd'hui.

Le test coûte une semaine, pas six mois : une page de destination avec le prix affiché à 29 $, 300 $ de trafic sur `time tracker` et `track my hours`, et on regarde le taux d'inscription à l'essai. Si personne ne clique au prix affiché, la thèse tombe et on l'aura su pour 300 $.

**C'est le premier test que je ferais, avant d'écrire une ligne de code de plus.**
