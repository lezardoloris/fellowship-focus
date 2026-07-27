# Plan — le tracking comme moat (Epic TRK)

*27/07/2026. Écrit après lecture des 7 jours de données réellement collectées sur la machine d'Etienne. Chaque chiffre ci-dessous vient de `~/.fellowship-focus/usage/`, pas d'une estimation.*

---

## 1. Ce que la machine a réellement enregistré

| Jour | Total suivi | work | distraction | personal | **neutral** |
|---|---|---|---|---|---|
| 21/07 | 4,6 h | 0,9 | 1,4 | 0,2 | **2,0** |
| 22/07 | 4,4 h | 1,4 | 0,9 | 0,3 | **1,7** |
| 23/07 | 5,8 h | 2,7 | 0,6 | 0,5 | **2,0** |
| 24/07 | 4,7 h | 1,9 | 0,8 | 0,4 | **1,6** |
| 25/07 | 4,3 h | 1,5 | 1,4 | 0,2 | **1,2** |
| 26/07 | 2,1 h | 0,7 | 0,4 | 0,2 | **0,7** |
| 27/07 | 1,0 h | 0,6 | 0,2 | 0,0 | **0,3** |

**Top applications sur 7 jours** : chrome 12,6 h · Cursor 9,1 h · WhatsApp 1,5 h · pythonw 1,3 h · un jeu 0,9 h.

---

## 2. Trois défauts qui rendent ces données inexploitables

### TRK-A · La plus grosse case est opaque · **le défaut principal**
`chrome` pèse **12,6 h, soit 45 % de tout le temps suivi**, dans un seul seau. C'est là que se trouvent à la fois le travail client (Google Ads, dashboards, docs) et la distraction. Le fichier ne garde que le nom du processus.

Le titre de la fenêtre, lui, **était déjà lu douze fois par minute** pour catégoriser, puis jeté. Le signal qui sépare « Google Ads · Mocenza » de « YouTube » existait, à chaque échantillon, et n'atteignait jamais le disque.

### TRK-B · La moitié du temps est non catégorisée
`neutral` totalise **9,5 h contre 9,7 h de `work`** sur la semaine, et domine 6 jours sur 7. Un classement qui range la moitié du temps dans « je ne sais pas » ne peut fonder ni score, ni facture. WhatsApp, 1,5 h, tombe dedans : les mots-clés visent les domaines web, pas l'application native.

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
