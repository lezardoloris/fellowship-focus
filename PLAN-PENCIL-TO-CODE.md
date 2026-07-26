# Plan — porter les maquettes Pencil dans le code (Epic PX)

*26/07/2026. Écrit parce qu'il manquait une étape évidente : les 5 écrans Pencil étaient des **propositions**, jamais implémentées. D'où « ça ouvre l'ancienne version » — le code n'avait pas bougé.*

---

## L'état réel

| | Pencil (maquette) | Code (livré) |
|---|---|---|
| Anneau de progression du timer | ✅ | ✅ **fait** (`TimerRing.tsx`) |
| Tuiles chiffres + deltas | ✅ | ✅ `StatTile` |
| Barres jour avec tooltip | ✅ | ✅ `BarSeries` (Recharts) |
| Panneaux premium, 4 tiers de texte | ✅ | ✅ tokens + 18 composants migrés |
| Timer strip compact (variante B) | ✅ | ❌ |
| Onglet Progress restructuré | ✅ | ❌ (contenu présent, ordre non revu) |
| Onglet Guild : ladder + journey premium | ✅ | ❌ |
| Settings : quiet hours + mute UI | ✅ | ⚠️ backend fait, UI desktop seulement |
| Aperçus de notifications | ✅ | ⚠️ existent, style non aligné |

---

## Le principe : la lib **sous** la maquette, pas à la place

La maquette Pencil définit **la composition** (hiérarchie, espacements, ce qui domine l'écran). Recharts fournit **les primitives de données** (axes, tooltips, échelles). On superpose : Recharts dessine, nos tokens colorent, la maquette décide de la place.

Concrètement, aucun graphique ne porte de couleur en dur — on passe un nom de ton (`accent`, `success`, `danger`) qui résout vers les tokens. Un graphique ne peut donc pas dériver du reste de l'UI.

---

## Epic PX — porter les écrans

### PX-1 · Hero du Focus tab · **fait**
- **Étant donné** une session en cours, **quand** le temps s'écoule, **alors** l'anneau se vide et les chiffres restent lisibles au centre.
- **Et** une pause éteint le halo ; un break passe sur un ton froid pour ne jamais confondre les deux états.
- *Livré* : `TimerRing.tsx`, intégré dans `BlockTab`.

### PX-2 · Barres jour partout · P1
- Remplacer les implémentations maison restantes par `BarSeries`.
- ⚠️ **Bloqué pour le calendrier du Focus tab** : ses barres portent aussi le score du jour sous chaque colonne et la surbrillance du jour courant. `BarSeries` ne sait pas encore étiqueter chaque barre — le migrer tel quel **perdrait** cette information. Étendre `BarSeries` (prop `renderLabel`) avant de toucher à celui-là.
- **Critère** : survoler une barre donne le jour et la valeur exacte ; l'échelle vient de la lib, plus de formule maison (il y en avait 3 différentes).

### PX-3 · Sparklines dans les tuiles · P2
- **Étant donné** un historique, **quand** une `StatTile` s'affiche, **alors** une sparkline montre la tendance sous le chiffre.
- *Dépend de* : `Sparkline` (livré) + une série historique côté API.

### PX-4 · Onglet Progress selon la maquette · P2
- Ordre : score + revue hebdo côte à côte, puis money pleine largeur, puis le reste.
- Supprimer les redondances restantes (l'audit comptait `streak` 4× — 2 corrigées, à finir).

### PX-5 · Onglet Guild premium · P3
- Journey avec les étapes en points reliés, ladder avec la ligne « moi » surlignée, feed compact.

### PX-6 · Settings : quiet hours + mute côté web · P3
- Le backend existe (`quiet_hours_start/end`, `notifications_muted_until`). Le web n'expose rien.
- **Critère** : couper le son depuis le web se reflète côté desktop via le même endpoint de prefs.

### PX-7 · Aperçus de notifications alignés · P3
- Les 4 types (recap, blocage critique, nudge, streak) reprennent le style des cartes premium.

---

## Ordre

1. **PX-2** (barres) — le plus visible, supprime la dernière duplication.
2. **PX-3** (sparklines) — gros gain perçu, peu d'effort.
3. **PX-4** (IA Progress).
4. PX-5 → PX-7.

## Règles

- **Jamais de hex dans un graphique** — un nom de ton, résolu vers les tokens.
- **`isAnimationActive={false}`** — nos panneaux se rafraîchissent toutes les 15-60 s ; l'animation d'entrée les faisait vibrer.
- **Toujours un état vide** — un graphique sans données dit pourquoi.
- **La maquette décide de la place, la lib décide du rendu.**
