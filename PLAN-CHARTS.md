# Plan — couche graphiques premium (Epic CH)

*Décidé et amorcé le 26/07/2026. Recharts 3.10.1 installé, `Charts.tsx` livré, MoneyPanel migré comme preuve.*

---

## Le choix de la lib

Tu proposais **dither-kit**. Je ne l'ai pas retenu, pour des raisons concrètes :

| Critère | dither-kit | Recharts 3.10.1 |
|---|---|---|
| React 19 | non documenté | **support officiel** (peerDep `^19`) |
| Prérequis | exige **shadcn** (`components.json`) — on ne l'a pas | aucun |
| Installation | CLI qui **copie du code** dans le repo (à maintenir soi-même) | dépendance npm classique |
| Dépendances tirées | `motion` + `d3` | aucune nouvelle vulnérabilité (vérifié) |
| Esthétique | tramage rétro/pixel | neutre, se plie à **nos** tokens |

Le tramage est un parti pris visuel fort qui jure avec l'identité actuelle (sombre, terracotta, Cinzel). Recharts ne dessine rien d'opinionné : c'est nous qui imposons le style — et c'est exactement ce qu'on veut maintenant qu'on a une couche de tokens.

**Note honnête** : Recharts est aussi ce sur quoi reposent les charts de shadcn/ui, la référence premium actuelle. On a donc le même socle, sans dépendre de leur CLI.

---

## Ce qui est déjà livré

`web/src/components/Charts.tsx` — surface volontairement minuscule, couleurs lues depuis les tokens (on passe `accent` / `success` / `danger`, jamais un hex) :

| Composant | Usage |
|---|---|
| `BarSeries` | Le cheval de bataille. Supporte une barre « remplie » à l'intérieur du total (le motif « l'orange c'est le temps payé »). |
| `HeatBars` | Intensité par barre — pour la heatmap des tentations. |
| `Sparkline` | Micro-tendance dans une tuile de stat. |
| `TrendArea` | Courbe remplie pour les vues semaine/semaine. |

Plus un **tooltip sombre** qui reprend `.premium-panel` au lieu du blanc par défaut de Recharts, et un **état vide** intégré.

**MoneyPanel est déjà migré** : les barres jour ne sont plus des `div` avec leur propre calcul d'échelle, et elles ont un vrai tooltip (avant : un `title=` HTML).

---

## Epic CH — migrer les graphiques restants

L'audit avait trouvé **le même graphique à barres écrit 5 fois, avec 3 formules d'échelle différentes**, aucun tooltip, aucun état vide.

### CH-1 · Barres jour du Focus tab · P1
**En tant qu'** utilisateur, **je veux** survoler une journée pour voir ses minutes exactes.
- **Étant donné** la semaine, **quand** je survole une barre, **alors** un tooltip donne le jour et les minutes.
- **Et** l'échelle est calculée par la lib, pas à la main.
- *Fichier* : `FocusTab.tsx` (`WeekPanel`, barres jour).

### CH-2 · Historique 8 semaines · P1
- **Étant donné** l'historique, **quand** il s'affiche, **alors** il utilise `BarSeries` avec un axe et un tooltip.
- *Fichier* : `FocusTab.tsx` (`LadderCard`).

### CH-3 · Barres jour de l'Agenda · P2
- Quasi-copie conforme de CH-1 — les deux disparaissent dans le même composant.
- *Fichier* : `AgendaPanel.tsx`.

### CH-4 · Heatmap des tentations · P2
- **Étant donné** les tentatives par heure, **quand** elles s'affichent, **alors** `HeatBars` module l'opacité selon l'intensité et le tooltip donne l'heure et le nombre.
- *Fichier* : `TemptationsPanel.tsx` (actuellement retiré du dashboard — à rebrancher si tu le réactives).

### CH-5 · Sparklines dans les tuiles · P2
- **Étant donné** une tuile de stat, **quand** il y a un historique, **alors** une sparkline montre la tendance sous le chiffre.
- *Fichiers* : `StatTile` (Panel.tsx) + MoneyPanel / WeekPanel.

### CH-6 · Tendance €/h et % facturable · P3
- La vraie valeur produit : les deux courbes qui disent si le business va mieux.
- **Étant donné** plusieurs semaines de données, **quand** j'ouvre Progress, **alors** `TrendArea` montre le taux effectif et le % facturable dans le temps.
- *Dépend de* : une série historique côté `/api/money` (aujourd'hui on ne renvoie que la période courante + la précédente).

### CH-7 · Barre de burn des projets · P3
- Remplacer la barre de progression maison de « Eating your margin » par le composant partagé.

---

## Ordre conseillé

1. **CH-1 + CH-2** (Focus tab) — le plus visible.
2. **CH-3** — supprime la duplication restante.
3. **CH-5** — les sparklines, gros gain perçu pour peu d'effort.
4. **CH-6** — demande d'abord l'historique côté API.

---

## Règles à tenir

- **Jamais de hex dans un graphique** : on passe un nom de ton (`accent`, `success`, `danger`), qui résout vers les tokens. Un graphique ne peut donc pas dériver du reste de l'UI.
- **`isAnimationActive={false}`** partout : les animations d'entrée de Recharts font vibrer les panneaux à chaque poll (nos données se rafraîchissent toutes les 15-60 s).
- **Toujours un état vide** : un graphique sans données doit dire pourquoi, pas afficher une zone morte.
