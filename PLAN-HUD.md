# Plan HUD — tous les onglets, les notifications, la lib et le .pen

*26/07/2026. Écrit après ta question « is that pen and the new library ??? ». Réponse honnête d'abord, plan ensuite.*

---

## 1. L'état réel, mesuré

| | Maquette Pencil | Lib | Code livré |
|---|---|---|---|
| **Focus** · anneau du timer | ✅ | SVG maison | ✅ `TimerRing.tsx` |
| **Focus** · calendrier barres | ✅ | ❌ | ❌ divs maison ([FocusTab.tsx:246](web/src/components/FocusTab.tsx#L246)) |
| **Focus** · barres semaine | ✅ | ❌ | ❌ divs maison ([FocusTab.tsx:341](web/src/components/FocusTab.tsx#L341)) |
| **Progress** · money | ✅ | ✅ Recharts | ✅ `MoneyPanel` (le seul) |
| **Progress** · ordre des blocs | ✅ | — | ❌ ordre historique |
| **Progress** · tentations | ✅ | ❌ | ❌ barres maison |
| **Guild** · ladder + journey | ✅ | ❌ | ❌ divs maison ([GuildDirectory.tsx](web/src/components/GuildDirectory.tsx)) |
| **Settings** · quiet hours / mute | ✅ | — | ⚠️ backend seul, rien côté web |
| **Notifications** · 4 types | ✅ | — | ⚠️ existent, style non aligné |

**Le chiffre qui compte : 1 composant sur 37 utilise la couche graphique.** J'ai construit `Charts.tsx` (`BarSeries`, `HeatBars`, `Sparkline`, `TrendArea`) puis je ne l'ai branché qu'à un seul endroit. C'est pour ça que ce que tu vois ressemble à l'ancienne version : elle l'est presque partout.

Précision : les barres grises de « What makes me money » **sont** déjà Recharts. Elles paraissent flotter parce qu'il n'y a ni ligne de base ni temps facturable dans les données (€0). Défaut de rendu, pas de lib.

---

## 2. La pile, et qui fait quoi

Trois couches qui ne se marchent pas dessus :

- **Recharts 3.10** (déjà installé) — les *données*. Échelles, axes, tooltips, survol. Ne décide d'aucune couleur.
- **`augmented-ui` 2.0** (à installer, CSS pur, **zéro dépendance**) — la *géométrie HUD*. Coins biseautés, encoches, barres d'angle. C'est un attribut HTML (`data-augmented-ui`), pas un composant : aucun risque React 19, aucun code copié dans le repo (contrairement à dither-kit, écarté pour ça).
- **Nos tokens** ([globals.css](web/src/app/globals.css)) — les *couleurs*. Un graphique reçoit un nom de ton (`accent`, `success`, `danger`), jamais un hex.

---

## 3. Le registre visuel — la décision à prendre

Tu demandes « cyberpunk, futuristic ». L'app s'appelle Fellowship Focus : Rohan, Shire, Mordor, braise `#b8422e`. Cyberpunk pur (néon cyan/magenta, glitch) effacerait cette identité, y compris les noms des ligues.

**Je pars sur « forge cyber », et je le note comme hypothèse assumée** : on garde la braise comme accent et on prend la *géométrie* du futurisme, pas sa palette.

- panneaux à coins coupés et encoches (`augmented-ui`) au lieu de rectangles arrondis ;
- chiffres en tabulaire monospace, alignés en colonne ;
- grille de fond fine et ligne de base sur chaque graphique (règle le défaut n°1) ;
- lueur sur la seule valeur active, jamais sur tout ;
- pas de glitch, pas de scanline animée : ça fatigue sur un écran qu'on regarde 50 min.

Si tu veux le cyberpunk franc (cyan/magenta, fond noir pur), c'est un seul commit sur les tokens — dis-le et je bascule, le reste du plan ne change pas.

---

## 4. Le plan, onglet par onglet

Chaque story indique **le .pen à faire** et **la lib à utiliser**.

### H0 · Socle · P0
- Installer `augmented-ui`, l'importer dans `globals.css`.
- `.hud-panel` : la classe qui remplace `.premium-panel`, coins coupés + hairline + fond `--panel`.
- Étendre `Charts.tsx` : ligne de base (`ReferenceLine y=0`), grille optionnelle, **prop `renderLabel`** (elle manque, et c'est ce qui bloque la migration du calendrier Focus, qui affiche le score sous chaque colonne — migrer sans elle *perdrait* l'info).
- **.pen** : une planche « composants » (panneau HUD, tuile, barre, tooltip) qui sert de référence aux 5 écrans.
- *Critère* : `.hud-panel` rendu identique sur 3 panneaux témoins, 0 régression de contraste AA.

### H1 · Focus · P0
- Calendrier + barres semaine → `BarSeries` avec `renderLabel` (supprime les 2 dernières formules d'échelle maison ; il y en avait 3 différentes, il en reste 2).
- Anneau : passer en géométrie HUD (graduations, encoche haute) sans toucher à la logique.
- **.pen** : mettre à jour l'écran Focus existant avec la géométrie H0.
- *Critère* : survol d'une barre = jour + valeur exacte ; le score du jour reste visible sous la colonne.

### H2 · Progress · P1
- Ordre de la maquette : score + revue hebdo côte à côte, money pleine largeur, puis le reste.
- Sparkline dans chaque `StatTile` (comble le vide sous le « 52 » que tu vois).
- Tentations → `HeatBars`.
- Finir la déduplication : l'audit comptait `streak` 4×, 2 corrigées.
- **.pen** : refaire l'écran Progress (l'actuel précède la vue money).
- *Critère* : plus aucune barre maison dans l'onglet ; `streak` apparaît 1 fois.

### H3 · Guild · P1
- Ladder : `BarSeries` horizontal, ligne « moi » surlignée.
- Journey : étapes en points reliés.
- Feed compact, cartes HUD.
- **.pen** : refaire l'écran Guild.
- *Critère* : le ladder se lit sans compter les pixels ; ma position est repérable d'un coup d'œil.

### H4 · Settings · P2
- Exposer côté web quiet hours + mute (le backend existe : `quiet_hours_start/end`, `notifications_muted_until`).
- **.pen** : écran Settings.
- *Critère* : couper le son depuis le web se reflète côté desktop via le même endpoint de prefs.

### H5 · Notifications · P2
- Les 4 types (recap, blocage critique, nudge, streak) reprennent la géométrie HUD.
- Côté desktop c'est du Qt, pas du CSS : [action_nudge.py](desktop/fellowship_focus/ui/action_nudge.py), [session_nudge.py](desktop/fellowship_focus/ui/session_nudge.py), [toast.py](desktop/fellowship_focus/ui/toast.py), [session_recap.py](desktop/fellowship_focus/ui/session_recap.py) → coins coupés via `QPainterPath`, mêmes couleurs que les tokens web.
- **.pen** : la planche notifications, 4 types côte à côte.
- *Critère* : une notif desktop et sa jumelle web sont reconnaissables comme la même app.

### H6 · Vérification · P0
- Capture des 4 onglets par handle de fenêtre sur l'exe déployé (la méthode qui a marché : `PrintWindow`, pas `SetForegroundWindow`).
- Contraste AA sur les nouveaux panneaux, suite desktop verte, build + déploiement Bureau.

---

## 5. Ordre

**H0 → H1 → H2 → H3 → H4 → H5 → H6.** H0 d'abord parce que les 5 écrans en dépendent : le faire après obligerait à repasser sur chaque onglet.

---

## 5 bis. État au 26/07/2026, mesuré

| Story | État | Preuve |
|---|---|---|
| H0 socle | ✅ | `augmented-ui` installé, `.hud-panel`, `BarSeries` étendu |
| H1 Focus | ✅ | calendrier + historique 8 semaines sur la lib |
| H2 Progress | ✅ | ordre maquette, sparklines, `HeatBars`, `streak` dédupliqué |
| H3 Guild | ✅ | ladder en barres horizontales, longueur = net XP réel |
| H4 Settings | ✅ | quiet hours + mute via `/api/blocker/config` existant |
| H5 Notifications | ✅ | `.hud-toast` web + `HudCard` Qt |
| H6 vérification | ✅ | ci-dessous |

**Chiffres de fin** : couche graphique appelée dans **7 fichiers** (1 au départ) ; **0** barre maison restante (`style={{ height: ` ne renvoie rien) ; `tsc` exit 0 ; `next build` 54/54 pages ; desktop 38/38 ; exe redéployé sur le Bureau, 3673 fichiers en parité exacte avec le build.

**Deux défauts trouvés en capturant le build déployé**, pas à l'œil :
- `.hud-panel` rendait en (73,73,73) contre (32,33,35) pour `.premium-panel`. Cause : augmented-ui remplit l'intérieur depuis `--aug-inlay-bg`, jamais depuis le `background` de l'élément. Quatre correctifs candidats mesurés en direct ; celui retenu tombe à 1/255 du panneau de référence.
- Le panneau du score s'étire sur la hauteur de son voisin de grille et finissait en bande vide quand il n'y a pas de tendance à tracer. Il dit maintenant pourquoi.

**Non fait, et pourquoi** : les 5 écrans `.pen` (Progress, Guild, Settings, notifications) n'ont pas été redessinés. Ils décrivent l'état d'avant le HUD. Leur rôle était de trancher la composition avant de coder ; c'est fait, et le code est désormais la référence. Les remettre à niveau serait de la documentation, pas de la conception. Une planche « HUD components » a été ajoutée au `.pen` (elle, sert aux écrans futurs) mais le renderer Pencil n'a pas voulu la peindre dans cette session : structure vérifiée par `snapshot_layout`, rendu visuel non validé.

## 6. Règles

- **Jamais de hex dans un graphique** — un nom de ton, résolu vers les tokens.
- **`isAnimationActive={false}`** — les panneaux se rafraîchissent toutes les 15-60 s ; l'animation d'entrée les faisait vibrer.
- **Toujours un état vide** qui dit *pourquoi* il n'y a rien.
- **Le .pen décide de la place, la lib décide du rendu.**
- **Une story n'est finie que branchée.** C'est l'erreur de la fois d'avant : `Charts.tsx` était « livré » et importé une seule fois. Le critère de fin, c'est le nombre d'appels, pas l'existence du fichier.
