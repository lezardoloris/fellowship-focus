# Rapport — chantier UX, design, vitesse & notifications

*Fellowship Focus · juillet 2026. Tout ce qui suit est mesuré dans le code réel, pas estimé.*

---

## Le problème de départ

Tu avais trois plaintes : le bouton on/off qui ne répond pas, un design qui ne fait pas premium, et des notifications intrusives. Trois audits du code (avec preuves `fichier:ligne`) ont trouvé des causes précises — et un vrai bug que personne n'avait vu.

---

## 1. Le bouton on/off — de 19 secondes à 0,4 ms

### Ce qui n'allait pas
Les deux chemins (armer/désarmer) exécutaient **des sous-processus, des écritures registre, des appels HTTP et un scan de tous les processus de la machine — en synchrone sur le thread graphique Qt**. Pendant ce temps la fenêtre était gelée.

Et aucun des deux widgets n'affichait l'état "arming" que le backend suivait pourtant déjà : l'interrupteur **retombait visuellement sur OFF** pendant les 3 à 50 secondes d'armement. D'où la sensation que le clic était ignoré.

| Mesure | Avant | Après |
|---|---|---|
| Retour du clic "off" | 1,2-8 s typique, **~19 s pire cas** | **0,4 ms** |
| `netsh` (timeout 10 s) à chaque refresh d'UI | oui | mis en cache 30 s, sur worker |
| Délai mort avant le 1er sondage | 1000 ms fixes | 0 ms + backoff 100/200/400/800 |
| POST réseau au désarmement | bloquant (jusqu'à 75 s si réseau mort) | fire-and-forget |

### Corrections
- **Désarmement optimiste** : l'état bascule et l'écran se repeint *d'abord*, le démontage lourd part sur un worker.
- **État "arming" rendu** : l'interrupteur reste ON avec "Arming shield…" au lieu de retomber.
- **Epoch d'armement** : un double-clic arm→disarm→arm laissait deux chaînes de timers concurrentes. Les anciennes s'annulent maintenant.
- **Annulation depuis le web** : impossible avant (le garde ne testait que `blocker_active`, pas `_blocker_arming`).

**Vérifié** : 10/10 tests d'état des widgets, 5/5 tests de désarmement.

---

## 2. Le bug que personne n'avait vu — double pénalité XP

**Bouclier desktop armé + extension active = deux pénalités pour un seul blocage.**

L'extension continuait d'appliquer ses blocages en parallèle et de poster sur `/api/blocks`, alors que le proxy desktop rapportait déjà le même hit. Le garde `desktopShieldOn` existait pour les nudges doux mais **pas pour les blocages durs**.

Les deux écrivains de pénalité de l'extension (`reportBlock` et `notifyBlocked`) cèdent maintenant la main au desktop quand son bouclier est détecté. Le blocage visuel reste local ; seule la double comptabilisation disparaît.

---

## 3. Le design — pourquoi ça ne faisait pas premium

### La cause racine
Les variables CSS existaient **mais n'étaient jamais exposées à Tailwind**. Chaque composant inventait donc ses propres valeurs. Résultat mesuré :

| | Avant | Après |
|---|---|---|
| Couleurs hex en dur | **41** (dont 12 oranges quasi-identiques pour une seule couleur de marque) | ~12 tokens sémantiques |
| Tiers d'opacité de texte | **13** (230 occurrences) | **4** |
| Styles de panneaux coexistants | **6** | **1** |
| Nœuds de texte sous WCAG AA | **69** | **0** |
| Hovers morts (`hover:pp-*`) | 8 (Tailwind ne peut pas générer de variante hover sur une classe CSS simple) | 0 |
| `window.confirm` natifs | 6 | 0 |

Le pire cas : `StreakBadge` affiché **directement sur la vidéo sans panneau**, à ~2,6:1 de contraste. Il a maintenant une puce avec fond.

### Ce qui a été fait
- **Couche de tokens** exposée via `@theme` : on écrit `text-danger` au lieu d'un nouveau hex. J'ai vérifié que les utilitaires sont bien émis dans le CSS de production (un token qui ne génère rien échouerait en silence).
- **18 composants migrés** vers `premium-panel` + les 4 tiers de texte.
- **Composants partagés** créés : `Panel`, `StatTile`, `EmptyState`, `ErrorState`, `ConfirmAction`.
- **Deux hovers différents** sur des boutons identiques → un seul.

---

## 4. La fluidité — pourquoi "ça saute"

**7 panneaux faisaient `return null` pendant leur chargement**, puis s'inséraient d'un coup dans la mise en page en poussant tout vers le bas. MoneyPanel à lui seul faisait ~380 px de décalage à chaque chargement.

Corrections :
- **Skeletons à hauteur réservée** sur les panneaux principaux.
- **`min-height`** sur Billable : changer d'onglet ne redimensionne plus le panneau (ce qui déplaçait son voisin dans la grille).
- **États d'erreur** : un fetch qui échouait laissait un panneau absent sans explication. Chaque appel était un `if (res.ok)` silencieux.
- **Transitions** : les toasts apparaissaient d'un coup, les barres se téléportaient.
- **Le champ revenu** était écrasé toutes les 20 secondes pendant que tu tapes dedans.

---

## 5. Les notifications

### Ce qui n'allait pas
- **~12 notifications possibles en une heure**, aucun plafond global.
- **Aucune quiet hours, aucun mute global** dans tout le code (vérifié par recherche exhaustive).
- Chaque événement desktop **double-notifiait** (toast in-app + toast OS), systématiquement.
- **3 formulations différentes** pour le même événement "fin d'intervalle" selon la surface.
- `notify_streak_danger()` était écrit depuis des mois mais **jamais appelé**.

### Corrections
- **Une politique centrale** dans `notify()` : plus aucun site d'appel n'a à se souvenir de vérifier. C'est précisément l'absence de source unique qui avait produit le triple-fire.
- **Mute global** dans le tray : 1h / 8h / jusqu'à demain 7h.
- **Quiet hours** (gère les fenêtres qui traversent minuit).
- **BLOCK reste critique** et passe toujours : les quiet hours veulent dire "ne me harcèle pas", pas "laisse-moi scroller pendant une session que j'ai lancée".
- **Streak danger câblé** : au plus une fois par jour, après 20h, seulement si une série de 2+ jours est en jeu.

**Vérifié** : 11/11 tests de politique.

---

## 6. La structure — les onglets étaient inversés

C'était le problème de fond derrière ta question "on peut fusionner Block et Focus ?".

- **"Block"** contenait le timer, les presets, Start, le bouclier, la musique → la surface où on **travaille**
- **"Focus"** contenait score, digest, money, habitudes → la surface où on **relit**

Quand tu voulais te concentrer, tu cliquais sur "Focus"... et tu tombais sur des graphiques rétrospectifs.

**Corrigé** : `Focus` · `Progress` · `Guild`. Les identifiants internes restent inchangés pour que ton état d'onglet sauvegardé et les liens continuent de marcher — zéro refactor risqué.

Deux variantes ont été maquettées dans Pencil (fusion totale vs. renommage) ; la variante retenue est le renommage, parce que tout fusionner aggravait le problème déjà mesuré : 12 gros chiffres qui se disputent l'attention sur un seul écran.

Au passage : `streak` était affiché **4 fois** sur le même écran, `focus_hours` 3 fois. Dédupliqué.

---

## Ce qui reste

- **IA du Focus tab** : l'above-the-fold reste rétrospectif (score/digest/money) alors que l'actionnable (priorités du jour) est plus bas.
- **MoneyPanel / BillablePanel** dupliquent encore la même feature (table par client + rentabilité).
- **Migration vers `<Panel>`** : le composant existe et est prouvé, mais les ~59 sites d'appel utilisent encore la classe `premium-panel` directement. Sans risque, purement mécanique.
- **Skeletons** sur les 4 panneaux restants.

---

## Récapitulatif des commits

| Commit | Contenu |
|---|---|
| `3d7046f` | Toggle instantané (0,4 ms), état arming, cache des couches |
| `61c5842` | Skeletons, contraste, hovers morts, transitions |
| `51b40cf` | Travail bloquant hors du thread GUI (proof capture, réseau) |
| `a15f5f4` | Tokens exposés à Tailwind + Panel/StatTile/EmptyState |
| `db014ed` | Onglets Focus/Progress, bug double pénalité, mute + quiet hours |
| `fd7c160` | Migration complète des 18 composants, ConfirmAction, ErrorState |
