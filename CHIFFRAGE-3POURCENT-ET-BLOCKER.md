# « Gratter 3 % du marché » : le chiffrage, et les 20 mots-clés blocker

*28/07/2026. Toutes les enchères sont des `low_top_of_page_bid` réelles.*

---

## Partie 1 · Ton argument, testé

### Tu as raison sur le principe, et j'ai été trop catégorique

**Memtime fait 4 M$ par an dans un marché où Clockify est gratuit avec 7 millions d'utilisateurs.** La gratuité du leader n'interdit donc pas de gagner de l'argent. J'ai eu tort d'écrire « le tracker n'est pas monétisable » : la formulation juste est **« pas monétisable au prix de Clockify »**, ce qui n'est pas la même chose.

### Mais 3 % n'est pas la bonne unité

Ce qui compte n'est pas la part de marché, c'est le **rythme d'acquisition**.

Pour **40 k€ net par mois**, il faut environ **50 k€ de MRR** (marge SaaS ~80 %).

| Modèle | Prix | Clients payants nécessaires |
|---|---|---|
| Indépendant | 8 $/mois | **6 250** |
| Équipe (15 sièges) | 120 $/mois | **417** |

6 250 clients payants sur les 7 millions d'utilisateurs de Clockify, ce n'est **pas 3 %, c'est 0,09 %**. Ton instinct que le chiffre est petit est donc juste.

**Le problème n'est pas la taille de la cible, c'est le débit.** Atteindre 6 250 payants en 24 mois demande **260 nouveaux clients par mois**, tous les mois, sans interruption. C'est là que ça coince, pas sur la part de marché.

### Ce qui est réellement atteignable

Avec le trafic mesuré et un CAC réaliste, l'ordre de grandeur pour un solo est **15 à 25 k€ par mois de revenus** en 18 à 24 mois, pas 40 k€ net. Pour dépasser, il faut soit l'ARPU d'équipe (120 $ au lieu de 8 $), soit un canal gratuit à très gros volume.

**40 k€ net par mois en solo, c'est le niveau de Memtime avec 36 salariés.** Pas impossible à terme, mais pas un objectif à 24 mois.

---

## Partie 2 · Les 20 mots-clés « blocker »

### ① Bloqueur mobile · le plus gros volume, le moins cher

| Mot-clé | Volume | Enchère basse |
|---|---|---|
| **opal app** (marque) | **6 600** | **1,65 $** |
| **app blocker for iphone** | **2 400** | **1,14 $** |
| app blocker android | 880 | **1,05 $** |
| one sec app (marque) | 880 | **0,76 $** |
| block distracting apps | 260 | 0,83 $ |
| app to block apps | 170 | 1,11 $ |
| **Total** | **~11 200** | **~1,20 $** |

**Prix du marché** : Opal ~100 $/an, One Sec ~30 $/an. **Abonnement**, pas achat unique.

⚠️ **Mais c'est de l'iOS et de l'Android.** Ta pile est Windows, Next.js, extension Chrome. Ce cluster est le plus intéressant du tableau et c'est le seul que tu ne peux pas servir aujourd'hui.

### ② Bloqueur desktop / navigateur · **ton produit actuel**

| Mot-clé | Volume | Enchère basse |
|---|---|---|
| **blocksite** (marque) | **14 800** | **0,54 $** |
| website blocker chrome extension | 1 000 | 1,16 $ |
| website blocker mac | 390 | 1,36 $ |
| website blocker for windows | 170 | 1,28 $ |
| distraction blocker chrome | 10 | — |
| **Total** | **~16 400** | **~0,70 $** |

**0,54 $ le clic sur `blocksite` est le trafic le moins cher de toute l'étude.** Mais c'est une marque : BlockSite est une extension **gratuite** à plusieurs millions d'installations, donc du navigationnel qui cherche du gratuit.

**Intention réelle non-marque : ~1 600 recherches/mois.** C'est ça, ton marché adressable en achat direct.

### ③ Contenu adulte / accountability

| Mot-clé | Volume | Enchère basse |
|---|---|---|
| porn blocker for iphone | 1 000 | 1,26 $ |
| block adult websites | 480 | 1,43 $ |
| adult content blocker | 390 | 1,75 $ |
| accountability partner app | 210 | 1,82 $ |
| **Total** | **~2 080** | **~1,55 $** |

Prix du marché 9-17 $/mois, churn le plus bas. **Meilleur rapport prix/CPC de la carte**, avec l'avertissement de double usage déjà écrit.

### ④ Contenus spécifiques

| Mot-clé | Volume | Enchère basse |
|---|---|---|
| youtube blocker | 1 300 | **0,82 $** |
| social media blocker | 480 | 1,16 $ |
| screen time blocker | 210 | 0,83 $ |

---

## Partie 3 · L'économie, recalculée

À 8 $/mois avec 4 % de churn, **LTV = 200 $**. CAC = enchère × 80.

| Cluster | Enchère | CAC | LTV | **Ratio** |
|---|---|---|---|---|
| Desktop / navigateur | 0,70 $ | **56 $** | 200 $ | **3,6** ✅ |
| Mobile | 1,20 $ | 96 $ | 200 $ | **2,1** ⚠️ |
| Adulte / accountability | 1,55 $ | 124 $ | 200 $ (à 17 $/mois : 425 $) | **1,6 / 3,4** |

**Le cluster desktop passe.** Mon « le blocage n'est pas monétisable » était faux : il l'était **au modèle Cold Turkey** (39 $ une fois), pas à 8 $/mois. Le clic à 0,70 $ absorbe très bien un petit abonnement.

---

## Partie 4 · Le vrai plafond, sans enrobage

Trafic non-marque réellement achetable sur le desktop : **~1 600 recherches/mois.**

```
1 600 × 12 % de clics    = 192 clics/mois
192 × 0,70 $             = 134 $/mois de budget
192 × 1,25 %             = 2,4 clients/mois
2,4 × 8 $                = +19 $ de MRR par mois
```

**19 $ de MRR gagnés par mois.** C'est rentable (ratio 3,6) et c'est **négligeable**.

En ajoutant l'adulte et les contenus spécifiques, on monte à **~5 700 recherches non-marque**, soit environ 8 clients par mois et +64 $ de MRR mensuel.

> **Le blocage se monétise, mais le gisement est trop petit pour un objectif à 40 k€.**

---

## Partie 5 · Conclusion, et je m'y tiens

**Trois choses vraies en même temps :**

1. **Tu as raison** : la concurrence gratuite n'interdit pas de gagner de l'argent (Memtime, 4 M$).
2. **J'avais tort** de dire le blocage non monétisable : à 8 $/mois et 0,70 $ le clic, le ratio est de 3,6.
3. **Mais le volume plafonne** : 5 700 recherches non-marque par mois, soit ~8 clients/mois. C'est un complément de revenu, pas 40 k€.

**Le seul cluster avec du vrai volume est le mobile** (11 200 recherches, Opal à 100 $/an), et c'est celui que ta pile ne couvre pas. **C'est la vraie information de cette analyse** : la demande est sur iOS et Android, ton produit est sur Windows et Chrome.

Deux options honnêtes :
- **Accepter le petit volume** : campagne desktop rentable à 150-400 $/mois, quelques clients par mois, revenu d'appoint.
- **Aller où est la demande** : une app mobile de blocage, ce qui est un produit neuf et une compétence que tu n'as pas encore livrée.

Je ne recommande ni l'un ni l'autre sans que tu tranches d'abord : veux-tu un complément de revenu sur ce que tu as déjà, ou un vrai business qui demande d'apprendre le mobile ?
