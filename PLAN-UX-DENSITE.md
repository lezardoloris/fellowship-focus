# Plan UX — densité, doublons, hiérarchie (Epic UX)

*26/07/2026. Écrit après audit du build déployé : hauteur de page, densité d'encre par panneau, et détection des blocs rendus dans plusieurs onglets. Rien ici ne vient d'une impression visuelle seule.*

---

## 1. Ce que l'audit mesure

**Longueur des pages** (fenêtre 1280x900) :

| Onglet | Hauteur | En écrans |
|---|---|---|
| Focus | 1 270 px | 1,4 |
| Progress | 2 878 px | 3,2 |
| **Guild** | **3 834 px** | **4,3** |

**Blocs rendus deux fois** (contenu identique, pas seulement le titre) :

| Bloc | Onglets | Coût |
|---|---|---|
| Habit tracker | Progress + Guild | 498 px × 2 |
| Weekly review | Progress + Guild | 251 px × 2 |
| Temptations | Progress + Guild | 181 px × 2 |
| Agenda & OKR | **imbriqué dans lui-même** (1 177 px contenant 1 127 px) | un panneau dans un panneau |

**1 177 px de l'onglet Guild sont une copie de l'agenda personnel.** C'est le tiers de la page. Le problème n'est pas le style, c'est que les onglets ne savent pas ce qu'ils possèdent.

**Densité d'encre** (caractères par 1 000 px² ; sous 0,6 le panneau réserve plus de place qu'il n'en remplit) :

| Panneau | Taille | Densité |
|---|---|---|
| Shutdown | 1088×265 | **0,07** |
| Tasks | 536×300 | **0,12** |
| Timer 50:00 | 536×537 | 0,39 |
| What makes me money | 1088×407 | 0,43 |
| Focus score | 536×251 | 0,54 |
| Temptations | 1088×181 | 0,53 |
| *Activity (référence haute)* | 534×372 | *7,13* |

Un panneau vide occupe aujourd'hui exactement la même surface qu'un panneau plein. C'est ce qui fait paraître l'app inachevée alors que les données sont là.

---

## 2. Le diagnostic, par coût décroissant

**a. L'architecture, pas le style.** Guild affiche l'agenda personnel, le suivi d'habitudes, la revue hebdo et les tentations, qui appartiennent tous à Progress. On lit deux fois la même semaine dans deux onglets. Aucun réglage de couleur ne répare ça.

**b. La place réservée ne suit pas le contenu.** Les panneaux ont des hauteurs fixes pensées pour le cas plein. Au cas vide ils laissent des bandes mortes : Shutdown réserve 265 px pour 20 caractères.

**c. Le signal est trop petit pour être lu.** Les sparklines des tuiles KPI font quelques dizaines de pixels et se lisent comme des rayures, pas comme des tendances. Sur tes captures, celle de « tracked » déborde visuellement sur la colonne voisine. L'historique 8 semaines n'a qu'une barre à l'extrême droite et ressemble à un bug.

---

## 3. Epic UX

### UX-1 · Chaque bloc a un seul propriétaire · P0
- Guild garde ce qui est **collectif** : le hall, l'arène (ladder, paris, feed), le journey, la confiance, le ladder d'habitudes (comparatif).
- Progress garde ce qui est **personnel** : agenda, OKR, revue hebdo, tentations, suivi d'habitudes.
- Supprimer l'imbrication `Agenda & OKR` dans `Agenda & OKR`.
- **Critère** : l'audit ne trouve plus aucun bloc dans deux onglets ; Guild passe sous 2 200 px.

### UX-2 · Un panneau vide se rétracte · P0
- Règle : pas de hauteur réservée pour des données absentes. Un panneau sans contenu se réduit à son titre plus une ligne qui dit quoi faire, et rend son bouton d'action immédiatement.
- Cibles mesurées : Shutdown (0,07), Tasks (0,12), Focus score (0,54).
- **Critère** : plus aucun panneau sous 0,45 de densité ; les cas vides gagnent un bouton, pas un vide.

### UX-3 · Les tuiles côte à côte s'alignent sur la plus courte · P1
- `Focus score` et `Weekly review` sont forcées à 251 px par la plus haute. Utiliser un alignement en haut plutôt qu'un étirement, ou déplacer du contenu pour équilibrer réellement.
- **Critère** : plus de bande morte sous un chiffre.

### UX-4 · Une sparkline se lit ou disparaît · P1
- Retirer les sparklines des petites tuiles KPI : à cette taille elles ajoutent du bruit, pas de l'information.
- Les garder là où la tendance est le sujet (score du jour, temps suivi), avec une hauteur utile et une échelle bornée.
- Corriger le débordement de la sparkline sur la colonne voisine dans la vue money.
- **Critère** : chaque sparkline restante a au moins 40 px de haut et reste dans sa colonne.

### UX-5 · Les graphiques utilisent leur hauteur · P1
- Les barres de la vue money occupent le bas de leur zone ; l'échelle est écrasée par un maximum lointain. Borner l'échelle aux données visibles.
- L'historique 8 semaines avec une seule barre doit afficher son état vide plutôt qu'un graphique à un point.
- **Critère** : la barre la plus haute atteint au moins 70 % de la zone de tracé.

### UX-6 · Le fond cesse de concurrencer le contenu · P2
- La scène rouge passe entre les panneaux à pleine intensité. Sur les zones de données, l'assombrir pour que les panneaux dominent.
- **Critère** : contraste AA conservé, et le regard va au chiffre avant d'aller au décor.

### UX-7 · L'onglet Focus mérite sa place · P2
- Densité 0,39 sur le bloc timer, 0,45 sur la liste de blocage. La liste de 25 domaines est un mur de puces sans hiérarchie.
- Grouper par préréglage, replier au-delà de 8, garder la recherche visible.
- **Critère** : la liste tient en un écran sans défilement à 900 px.

---

## 4. Ordre

**UX-1** puis **UX-2** d'abord : à eux deux ils retirent environ 1 900 px de page et suppriment la sensation de doublon. Le reste est du réglage.

---

## 5. Règle qui manquait

Les stories précédentes ont dédupliqué `streak` au niveau d'une valeur, pas au niveau des blocs. La règle à retenir : **un bloc appartient à un onglet, et un onglet ne montre pas ce qu'un autre possède.** Sans ça, chaque ajout de panneau se recopie tout seul.
