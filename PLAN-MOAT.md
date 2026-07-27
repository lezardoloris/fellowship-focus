# Le moat, honnêtement (et ce que dirait Hormozi)

*27/07/2026. Écrit après la question « c'est quoi vraiment le moat complet ? ». Rien ici n'est flatteur par défaut : ce qui n'est pas défendable est dit comme tel.*

---

## 1. Ce qui n'est PAS un moat

Il faut commencer par là, sinon le reste ne veut rien dire.

| Brique | Concurrents établis | Verdict |
|---|---|---|
| Bloquer des sites | Cold Turkey (10 ans), Freedom, LeechBlock (gratuit), one-sec, Opal | **Aucun moat.** Parité au mieux. |
| Suivre le temps d'écran | RescueTime, Rize, Timing, ActivityWatch (open source, gratuit) | **Aucun moat.** |
| Facturer des heures | Toggl, Harvest, Clockify | **Aucun moat.** |

Les quatre couches de blocage (proxy, hosts, pare-feu QUIC, extension) sont de la bonne ingénierie. Elles amènent à parité avec Cold Turkey, pas devant.

---

## 2. Le moat réel : une soustraction que personne d'autre ne peut faire

Chaque concurrent détient **une moitié** de l'équation.

- **Toggl, Harvest** savent ce que tu as **facturé**, mais dépendent d'un chrono que tu dois lancer. Tu oublies. C'est leur faille structurelle, pas un bug.
- **Rize, RescueTime** savent ce que tu as **fait**, automatiquement, mais n'ont aucune notion de facture ni de client payant.
- **Cold Turkey** sait ce qu'il a **bloqué**, et rien d'autre.

Fellowship a les trois dans **une seule base, sur une seule machine, horodatés**. Il peut donc calculer un chiffre que littéralement aucun d'eux ne peut produire :

> **Les heures que tu as travaillées pour un client et qui ne sont sur aucune facture.**

**La limite, dite franchement** : c'est un moat **produit** (intégration), pas un moat **technique**. N'importe lequel des trois pourrait le construire. Ce qui le protège vraiment, c'est le temps : la donnée s'accumule et devient un coût de sortie, et les règles de catégorisation que tu as répondues une fois ne se re-répondent pas ailleurs.

### ⚠️ Correction du 27/07, après vérification : ce moat est plus étroit que je ne l'ai écrit

J'ai affirmé que personne ne pouvait faire la soustraction. **C'est faux, et il fallait chercher avant de l'affirmer.**

**[Memtime](https://www.memtime.com/freelancers)** fait déjà l'essentiel : suivi automatique du bureau, démarrage sans geste, données **100 % locales**, ciblage explicite des freelances. Et sa promesse est exactement celle que je t'avais recommandée, formulée mieux : **« +20 % d'heures facturables en moyenne »**, « récupère au moins 10 % du temps facturable perdu ». 12 à 15 €/mois, sans palier gratuit.

Ce qui reste réellement différenciant, et c'est plus mince mais plus solide :

1. **Memtime ne bloque rien.** Aucune couche d'exécution. C'est un observateur.
2. **Memtime ne facture pas**, il exporte vers FreshBooks, Toggl, Clockify. La soustraction « travaillé moins facturé » traverse donc **deux outils** chez eux, et un seul chez toi.

La formulation juste n'est donc pas « la soustraction que personne ne peut faire », mais :

> **Le seul outil où la mesure et l'exécution sont le même produit.**

C'est ce qui fait tourner la boucle du §3, et c'est ça qui n'existe nulle part ailleurs.

---

## 3. Pourquoi les trois couches sont nécessaires (le vrai mécanisme)

C'est ici que se trouve la réponse à « le moat complet ».

> **Le bloqueur est la rétention. Le tracker est la donnée. La vue argent est la raison de payer.**

Chacun seul échoue, et échoue de façon prévisible :

- **Bloqueur seul** : tu churnes dès que l'habitude est prise, ou dès qu'elle casse.
- **Tracker seul** : passif. Tu le regardes une semaine, tu ne l'ouvres plus. C'est la mort de RescueTime.
- **Facturation seule** : elle a besoin d'une donnée que tu ne saisiras jamais à la main.

Le bloqueur te fait ouvrir l'app **tous les jours**. Cette ouverture quotidienne fait tourner le tracker. Le tracker rend la vue argent exacte. La vue argent justifie l'abonnement. **C'est un cycle, et c'est ça le moat complet**, pas une des trois briques.

---

## 4. « TRACK PROFIT » : oui, avec une correction

Le cadrage est meilleur que « Focus ». Mais sois précis sur ce qui est mesuré :

L'outil ne suit pas le **profit** (il ignore tes charges). Il suit le **temps qui produit du revenu**, et surtout **l'écart entre ce temps et ce qui est facturé**. Promettre « profit » et livrer « heures non facturées » crée une déception à la première ouverture.

Formulation défendable : **« Sache quelles heures te rapportent. »**

---

## 5. Ce que dirait Hormozi

Son équation de valeur : *(résultat rêvé × probabilité perçue) / (délai × effort)*.

**a. Le résultat rêvé n'est pas la concentration.** Un freelance à 80 €/h ne rêve pas d'un score sur 100. Il veut **plus d'argent pour les mêmes heures**. Hormozi dirait : arrête de vendre le focus, vends le revenu récupéré. Le focus est le mécanisme, pas la promesse.

**b. L'effort est ton avantage décisif.** Toggl demande de lancer un chrono. Toi, zéro geste. Dans son équation, l'effort est au dénominateur : le diviser par zéro fait exploser la valeur perçue. **C'est ton meilleur argument et il est structurel**, pas une feature.

**c. Le délai doit être d'une semaine, pas d'un trimestre.** La première ouverture doit montrer de l'argent trouvé. D'où les trois lignes qu'on vient de mettre sur l'onglet Focus.

**d. La garantie qu'il exigerait**, et que tu es un des rares à pouvoir tenir parce que l'outil mesure la chose :

> **« On trouve au moins X heures non facturées en 30 jours, ou tu ne paies pas. »**

**e. Niche jusqu'à ce que ça fasse mal.** Il dirait que « les freelances » n'est pas un marché. Un seul persona, celui où l'écart est le plus gros.

---

## 6. Le piège que Hormozi verrait et que je n'avais pas vu

**Il y a deux mécaniques d'argent, pas une, et elles ne s'adressent pas au même persona.**

| | Facturation à l'heure | Forfait / abonnement mensuel |
|---|---|---|
| Personas | dev freelance, consultant data | consultant PPC, comptable, formateur |
| Le chiffre qui compte | heures non facturées | **coût réel par client** |
| Ce qu'il en fait | il facture, cash immédiat | il **repricé ou vire** le client |
| Force de la garantie | forte, directe | indirecte |

Pour un forfait, « 2,1 h non facturées » ne vaut rien : le client paie pareil. Ce qui vaut, c'est **« le client A te prend 11 h/mois pour 900 €, le client B 3 h pour 900 € »**. Le premier est payé 82 €/h, le second 300 €/h.

**La même donnée, deux offres opposées.** Hormozi dirait d'en choisir **une** pour commencer, et il aurait raison : deux promesses dans une landing page, c'est zéro promesse.

---

## 7. Ma recommandation

**Commencer par le forfaitaire, en l'occurrence le consultant PPC.**

Trois raisons, dont une décisive :

1. **Tu en es un.** Tu es le cobaye avec de la vraie donnée, et tu ne peux vendre crédiblement que ce que tu vis. C'est la raison décisive.
2. **Le chiffre est plus violent émotionnellement.** « Ce client te paie 82 €/h » déclenche une action ; « tu as oublié de facturer 2 h » déclenche un haussement d'épaules.
3. **La valeur est récurrente et composée.** Repricer un client à +300 €/mois paie l'outil quinze fois, tous les mois, à vie. Une heure retrouvée se retrouve une fois.

Le contre-argument honnête : **la garantie est plus faible.** On ne peut pas promettre du cash, seulement une décision. La formulation devient : *« En 30 jours, tu sauras ton taux horaire réel par client, ou tu ne paies pas. »* Moins spectaculaire, mais tenable, et une promesse tenable vaut mieux qu'une promesse forte qui casse au premier remboursement.

---

## 8. Ce que ça change concrètement

- **Le nom** doit dire le revenu, pas la concentration. « Track profit » est la bonne direction, à préciser (voir §4).
- **Le premier écran** est déjà bon : trois lignes en euros et en heures. Il manque **le taux horaire réel par client**, qui est LE chiffre du persona retenu.
- **L'onboarding** doit demander une seule chose : combien te paie chaque client, et par mois ou par heure. Sans ça, rien de tout cela n'est calculable.
- **La couche guilde** garde son sens ici, mais recadrée : des pairs qui parient sur des objectifs, entre freelances, avec de l'argent réel. Ce n'est pas de la gamification étudiante, c'est de la responsabilité entre pairs. L'habillage Tolkien, lui, brouille le message.

---

## 9. Ce qui marche chez les concurrents (vérifié, pas de mémoire)

Prix relevés le 27/07/2026.

| Outil | Prix | Modèle | Ce qu'il vend |
|---|---|---|---|
| Cold Turkey | **39 $ une fois**, mises à jour à vie | achat unique | bloquer, très fort |
| Freedom | **39,99 $/an** | abonnement | bloquer, multi-appareils |
| RescueTime | gratuit, puis **7-9 $** (Focus), **12-15 $** (Solo+) | freemium | mesurer + focus |
| Rize | **9,99 $/mois** | abonnement | mesurer automatiquement |
| Memtime | **12-15 €/mois**, pas de gratuit | abonnement | **récupérer des heures facturables** |
| Toggl Track | gratuit jusqu'à 5 users | freemium | chrono en un clic |
| Harvest | en hausse forte après rachat Bending Spoons (×3 à ×4 rapportés) | abonnement | temps + facture |

### Les six choses qui marchent

**a. Chacun vend UN geste, jamais une suite.** Cold Turkey bloque. Toggl fait un clic. Memtime en fait zéro. Aucun ne vend « focus + tracking + facture ». C'est autant une opportunité qu'un avertissement : une suite est plus dure à expliquer en une phrase.

**b. Le plafond du marché solo est 10-15 €/mois.** Toute la catégorie s'y tient. Le seul écart est Cold Turkey à 39 $ une fois, et c'est précisément le modèle qui ne finance pas de développement continu.

**c. Ce qui fait payer n'est jamais la mesure, c'est la récupération.** Memtime ne vend pas « on suit ton temps », il vend « +20 % d'heures facturables ». Personne n'achète un graphique.

**d. Le gratuit est un choix, pas une évidence.** RescueTime et Toggl l'utilisent pour l'acquisition. Memtime n'a que 14 jours d'essai et vend quand même 12-15 €/mois. **Preuve qu'on peut se passer de gratuit si la promesse est chiffrée.**

**e. Le local-first est devenu un argument commercial**, plus une contrainte technique. Memtime et Timing le mettent en avant. C'est déjà ta position.

**f. Harvest perd des clients en ce moment.** Après le rachat par Bending Spoons, des utilisateurs rapportent des factures multipliées par 3 à 4. Des freelances cherchent activement à partir : c'est une fenêtre, et elle est datée.

### Ce que ça impose

- **Une seule phrase de promesse**, chiffrée, orientée récupération. Pas « bloque et suis ton temps ».
- **12 €/mois** est le prix naturel. Au-delà il faut une garantie explicite.
- **Ne pas copier le gratuit permanent** : sans budget d'acquisition, un free tier ne fait que gonfler les coûts.
- **La différence à marteler face à Memtime** : eux observent, toi tu empêches.

Sources : [Cold Turkey](https://getcoldturkey.com/), [RescueTime tarifs](https://www.saasworthy.com/product/rescuetime), [Rize](https://rize.io/best/best-time-tracking-app-2026), [Memtime freelances](https://www.memtime.com/freelancers), [Memtime tarifs](https://www.memtime.com/pricing), [Harvest après rachat](https://www.jobbers.io/best-time-tracking-apps-for-freelancers-2026-toggl-vs-harvest-vs-clockify-compared/).

---

## 10. Memtime marche-t-il, et gagne-t-il de l'argent ?

Vérifié le 27/07/2026.

| | |
|---|---|
| Chiffre d'affaires | **4 M$** (septembre 2025) |
| Effectif | **36 personnes** |
| Fondé | **2015** (ex-timeBro, Munich) |
| Levée | **1,59 M$**, Série A en 2023 (BayBG, Bayern Kapital) |
| Portée | utilisateurs dans plus de 90 pays |
| Clients cités | agences de pub, cabinets de conseil, équipes IT, **comptables, cabinets d'avocats** |

**Oui, ça marche.** C'est une vraie entreprise, rentable ou proche, peu financée (1,59 M$ levés pour 4 M$ de CA, ce qui est sain).

**Mais lis les ratios avant de te réjouir.**

- **4 M$ / 36 personnes = ~111 k$ par salarié.** Le repère sain en SaaS est 150 à 200 k$. Ils sont en dessous : ce n'est pas une machine à cash, c'est une PME qui tourne.
- **Onze ans pour atteindre 4 M$.** Le marché est réel mais **lent**. Personne ne devient riche vite ici.

**Et le détail qui change ta stratégie : regarde leur liste de clients.** Agences, cabinets de conseil, équipes IT, comptables, avocats. Ce sont des **entreprises**, pas des indépendants. La page « freelances » est du haut de tunnel ; **l'argent est au siège, en par-utilisateur, dans des cabinets.**

C'est cohérent avec toute la catégorie : le solo plafonne à 12-15 €/mois et churne, l'équipe paie 5 à 20 sièges et reste.

### Ce que ça implique pour toi

1. **Le marché est validé, mais il est lent.** Ne construis pas un plan qui suppose une croissance rapide.
2. **Ton barème n'est pas le leur.** 4 M$ à 36 personnes est un business médiocre. **200 à 300 k$ en solo serait excellent pour toi.** Tu n'as pas besoin de battre Memtime, tu as besoin d'une tranche.
3. **La question à trancher devient : solo ou cabinet ?** Memtime prouve que l'argent est côté cabinet. Mais un cabinet achète après une démo, un contrat et un DPO, ce qui est un métier différent de vendre à des indépendants.
4. **Ton angle blocage a plus de valeur en solo qu'en cabinet.** Un cabinet ne veut pas bloquer les sites de ses salariés (c'est un sujet social explosif) ; un indépendant le veut pour lui-même. **Ton moat pointe vers le solo, l'argent pointe vers les cabinets.** C'est la tension à résoudre avant d'écrire une ligne de landing page.

Sources : [getlatka](https://getlatka.com/companies/memtime.com), [levée Série A](https://www.memtime.com/blog/press-release-series-a-memtime), [Crunchbase](https://www.crunchbase.com/organization/timebro), [northdata](https://www.northdata.com/timeBro+GmbH,+M%C3%BCnchen/HRB+220442).
