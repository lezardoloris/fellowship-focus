# Plan — le tracking comme moat (Epic TRK)

*27/07/2026. Écrit après lecture des 7 jours de données réellement collectées sur la machine d'Etienne. Chaque chiffre ci-dessous vient de `~/.fellowship-focus/usage/`, pas d'une estimation.*

---

## 1. Ce que la machine a réellement enregistré


| Jour  | Total suivi | work | distraction | personal | **neutral** |
| ----- | ----------- | ---- | ----------- | -------- | ----------- |
| 21/07 | 4,6 h       | 0,9  | 1,4         | 0,2      | **2,0**     |
| 22/07 | 4,4 h       | 1,4  | 0,9         | 0,3      | **1,7**     |
| 23/07 | 5,8 h       | 2,7  | 0,6         | 0,5      | **2,0**     |
| 24/07 | 4,7 h       | 1,9  | 0,8         | 0,4      | **1,6**     |
| 25/07 | 4,3 h       | 1,5  | 1,4         | 0,2      | **1,2**     |
| 26/07 | 2,1 h       | 0,7  | 0,4         | 0,2      | **0,7**     |
| 27/07 | 1,0 h       | 0,6  | 0,2         | 0,0      | **0,3**     |


**Top applications sur 7 jours** : chrome 12,6 h · Cursor 9,1 h · WhatsApp 1,5 h · pythonw 1,3 h · un jeu 0,9 h.

---

## 2. Trois défauts qui rendent ces données inexploitables

### TRK-A · La plus grosse case est opaque · **le défaut principal**

`chrome` pèse **12,6 h, soit 45 % de tout le temps suivi**, dans un seul seau. C'est là que se trouvent à la fois le travail client (Google Ads, dashboards, docs) et la distraction. Le fichier ne garde que le nom du processus.

Le titre de la fenêtre, lui, **était déjà lu douze fois par minute** pour catégoriser, puis jeté. Le signal qui sépare « Google Ads · Mocenza » de « YouTube » existait, à chaque échantillon, et n'atteignait jamais le disque.

### TRK-B · La moitié du temps est non catégorisée

`neutral` totalise **9,5 h contre 9,7 h de `work*`* sur la semaine, et domine 6 jours sur 7. Un classement qui range la moitié du temps dans « je ne sais pas » ne peut fonder ni score, ni facture. WhatsApp, 1,5 h, tombe dedans : les mots-clés visent les domaines web, pas l'application native.

### TRK-C · Rien n'est horodaté

Le fichier est un total par jour et par application. Aucune séquence, aucune borne. Donc **impossible** de calculer : les changements de contexte, les vrais blocs de travail profond, les meilleures heures, ou ce qui précède une rechute. Toute l'analyse intéressante est exclue par le schéma lui-même.

*Et un quatrième, à part* : le tracker vit dans l'app. 2,1 h le 26 et 1,0 h aujourd'hui ne mesurent pas ta journée, ils mesurent le temps où la fenêtre était ouverte.

---

## 3. Ce qui est fait · TRK-1 · le journal d'événements

Un span par **changement** de fenêtre, écrit en JSONL à côté du rollup existant :

```json
{"at": 1769500000, "app": "chrome", "title": "Google Ads · Mocenza", "cat": "work", "sec": 420}
```

- **Écrit au changement, pas à chaque échantillon** : une journée coûte quelques centaines de lignes, pas 17 000.
- **Moins de 10 secondes est ignoré** : enchaîner cinq fenêtres en alt-tab est une décision, pas cinq travaux.
- **Local, jamais transmis.** Les titres nomment des clients et des documents. `screen_time_titles` (activé par défaut) coupe le champ titre **sans** couper la mesure du temps.

C'est ce qui rend possible, et rien d'autre ne le rendait : l'attribution par client, le comptage des ruptures d'attention, et l'analyse par heure.

---

## 4. La suite

### TRK-2 · Attribution par client · P0

Des règles titre → client (`"Mocenza" → Mocenza`, `"fellowship-focus" → interne`). C'est le chaînon qui manque à la vue money : le tracker saura que 6,2 h sont allées chez un client, la facturation saura ce qui est facturé, **la soustraction est l'argent oublié**.

### TRK-3 · Tuer la case `neutral` · P0

Objectif : moins de 15 % de non catégorisé, contre 49 % aujourd'hui. Deux leviers : les titres (déjà captés) et une file de classement où tu tranches en un clic les 5 titres les plus coûteux de la semaine. Chaque arbitrage devient une règle.

### TRK-4 · Suivre hors de l'app · P1

Un service léger indépendant de la fenêtre. **À arbitrer** : c'est un processus résident de plus, et le plan `PLAN-ARM-RELEASE.md` vient d'établir qu'on n'ajoute rien de persistant sans son retrait.

### TRK-5 · Ce que ça affiche · P1

Trois sorties, pas un graphique de plus : les heures non facturées de la semaine en euros ; le taux horaire réel par client ; l'heure de la journée où la rechute arrive.

---

## 5. La règle

**On n'affiche que ce qu'on sait attribuer.** `chrome : 12,6 h` n'est pas une donnée, c'est un aveu. Avant d'ajouter un écran, vérifier que la ligne qu'il montrerait pourrait porter un nom de client.

---

# Partie 2 — tracking fin, collaboratif et privé (TRK-6 → TRK-12)

*Suite de la partie 1. TRK-6 et TRK-7 détaillent le « comment » de TRK-2, TRK-8 celui de TRK-3, TRK-12 celui de TRK-5. Deux faits techniques vérifiés dans le code décident de toute l'architecture.*

## 6. Le verrou : aucune des deux moitiés ne voit le site à elle seule

**Fait 1.** Le titre de fenêtre Chrome sous Windows vaut `<titre de la page> - Google Chrome`. **Il ne contient pas l'URL, ni même le domaine.** Donc `chrome : 12,6 h` est indécomposable depuis le bureau, quelle que soit la finesse de l'échantillonnage. Aucune quantité d'enregistrement ne réparera ça.

**Fait 2.** L'extension voit les URL (`declarativeNetRequest`, `webNavigation`, `tabs`) mais **ne mesure aucun temps** : la seule chose qu'elle envoie, c'est un blocage (`{token, site}`). `tabs.onActivated` n'y sert qu'à l'application des règles.

Le bureau a le temps sans le site. Le navigateur a le site sans le temps. **La jointure est l'horodatage**, et c'est exactement ce que TRK-1 vient de rendre possible.

> Le bureau sait « chrome au premier plan de 14:02 à 14:41 ».
> L'extension sait « onglet actif x.com de 14:02 à 14:12, puis docs.google.com jusqu'à 14:41 ».
> L'intersection donne la seule ligne qui vaille : « x.com, 10 min, 14:02 ».

## 7. TRK-6 · Le temps par site vient de l'extension · P0

- L'extension mesure la durée de l'onglet actif par **domaine + premier segment de chemin**, en local.
- Le bureau joint sur l'horodatage et n'attribue au site que le temps où le navigateur était **au premier plan** : un onglet ouvert derrière une autre fenêtre n'est pas du temps passé.
- *Critère* : `chrome` disparaît du top applications et devient une liste de sites. Non catégorisé du navigateur sous 20 %.

## 8. TRK-7 · Travailler sur Twitter n'est pas scroller Twitter · P0

Le domaine seul n'y répond jamais. Le discriminant honnête et bon marché, c'est **le chemin** :


| Signal                              | Lecture                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `x.com/messages`, `/compose`        | conversation, prospection : **travail**                 |
| `x.com/home`, `/explore`            | fil : **distraction**                                   |
| `linkedin.com/messaging` vs `/feed` | même partage                                            |
| `youtube.com/watch` 40 min          | distraction ; 4 min répétées sur de la doc, autre chose |


Second signal, gratuit : **la forme de la durée.** Six visites de 90 secondes réparties dans l'heure ne valent pas un bloc de 9 minutes. La première est une fuite d'attention, la seconde est une tâche.

**Ce qu'on ne fera pas** : lire le contenu de la page, le texte des messages, ou capturer l'écran. L'intention se déduit de la structure de navigation, pas de ce qui est écrit.

## 9. TRK-8 · Catégorisation collaborative · P0

Tu as raison sur le fond : **49 % de ton temps est déjà en `neutral`** et ça ne s'améliorera pas tout seul, parce que le contexte est propre à chacun. `whispering` est un outil de travail chez toi et un mot inconnu ailleurs.

Le principe : **on ne devine pas en silence, on demande une fois, on n'oublie jamais la réponse.**

- **Au plus 3 questions par jour**, groupées à la fermeture, jamais pendant une session.
- On ne demande que sur **le plus cher** : le motif inconnu qui a consommé le plus de minutes cette semaine.
- **Un geste** : travail / distraction / perso, plus un client optionnel.
- **Chaque réponse devient une règle.** La même question ne revient jamais.
- **Le créneau horaire quand le motif ne suffit pas** : « mardi 11h-12h, on ne sait pas trancher » devient une question sur la plage, pas sur chaque fenêtre.
- *Critère* : après deux semaines, moins de 15 % de non catégorisé et moins d'une question par jour, faute de matière à demander.

## 10. TRK-9 · L'IA propose, tu tranches, et elle tourne en local · P1

Les titres et les chemins sont **la donnée la plus sensible de l'app**. Ils ne sortent pas de la machine, donc le modèle vient à eux.

- Modèle local, la brique existe : `d:\Documents\dashboard-ollama` (`ollama_client.py`, qwen3:8b).
- Rôle : **proposer** une catégorie et un client pour un motif inconnu, avec un niveau de confiance. Jamais décider seul.
- Sous le seuil de confiance, le motif part dans la file de TRK-8 au lieu d'être classé au hasard.
- **Pas de repli cloud.** Sans modèle local, la proposition automatique n'existe pas et la file manuelle suffit. Une commodité ne justifie pas d'envoyer tes titres de fenêtre ailleurs.

## 11. TRK-10 · Le modèle de confidentialité, écrit noir sur blanc · P0

**Stocké** : domaine, premier segment de chemin, titre tronqué à 180 caractères, horodatage, durée, catégorie.

**Jamais stocké** : URL complètes, paramètres de requête (ils portent identifiants et jetons), contenu de page, texte saisi, captures d'écran.

**Jamais transmis** : le journal reste local. Ce qui monte au serveur est agrégé et sans titres.

**Deux interrupteurs** : `screen_time_titles` coupe le titre sans couper la mesure du temps (déjà livré) ; une purge efface l'historique local en un clic.

**Rétention** : 90 jours de détail, agrégats au-delà. Un journal qu'on ne relit jamais est une fuite en attente.

## 12. TRK-11 · Personas freelance et la donnée qu'ils achètent · P1

Cinq profils tirés de `docs/POSITIONNEMENT.md`, avec **le chiffre unique** qui déclenche l'achat.


| Persona                         | Facture                    | Le chiffre qui vaut l'abonnement                                   | Ce que le tracking doit produire                                                |
| ------------------------------- | -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Consultant Google Ads / PPC** | forfait mensuel par compte | « Le client A me prend 11 h/mois pour 900 €, le B 3 h pour 900 € » | temps par client via les titres d'interface d'annonces (`Mocenza · Google Ads`) |
| **Développeur freelance**       | TJM ou horaire             | « 2,1 h non facturées cette semaine, 168 € »                       | temps par dépôt via le titre de l'éditeur, joint aux lignes de facture          |
| **Consultant data**             | mission longue             | « 40 % du temps en réunion, prévu 15 % »                           | part visio contre part outils, par mission                                      |
| **Comptable indépendant**       | forfait par client         | « Ce dossier coûte le double du forfait »                          | temps par dossier, seuil d'alerte                                               |
| **Formateur B2B**               | à la journée               | « Préparer coûte 3 h par heure vendue »                            | préparation contre livraison                                                    |


Le point commun, et c'est lui qui vend : **ils facturent au temps ou au forfait et ne savent pas où part le temps.** Le score de concentration n'intéresse aucun des cinq. Le taux horaire réel par client les intéresse tous.

**Les deux qui achèteront en premier** : le consultant PPC et le développeur. Plusieurs clients simultanés, un outil ouvert toute la journée qui porte le nom du client dans son titre, et un écart facturé/travaillé qu'ils soupçonnent sans pouvoir le chiffrer.

## 13. TRK-12 · La règle de productivité pour un freelance · P1

Pas un score sur 100. **Trois lignes, en euros et en heures :**

1. **Heures non facturées** cette semaine, converties au taux du client.
2. **Taux horaire réel** par client, temps réel compris et pas seulement déclaré.
3. **L'heure de la rechute** : le moment où la première distraction longue arrive, parce que c'est là qu'un blocage sert à quelque chose.

## 14. Ordre et règles

**TRK-6 puis TRK-7** (rendre le navigateur lisible), **TRK-8** (la file collaborative, qui fait vivre le reste), **TRK-10** en parallèle, puis TRK-9, TRK-11, TRK-12.

- **On ne montre pas une ligne qu'on ne sait pas attribuer.**
- **On ne devine pas en silence.** Une incertitude devient une question, une fois, et la réponse devient une règle.
- **La donnée sensible ne bouge pas.** Le modèle vient à elle, ou la fonctionnalité n'existe pas.

