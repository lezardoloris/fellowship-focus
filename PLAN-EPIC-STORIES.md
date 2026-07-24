# Fellowship Focus — Backlog produit (Epics & Stories)

> Backlog issu d'une analyse concurrentielle profonde (RescueTime, Sunsama, Rize.io, + Forest, Focusmate, Toggl, Cold Turkey, Opal, Session, Freedom, Flow) croisée avec l'inventaire de l'existant. **On ne re-spécifie pas ce qui existe déjà** (timer, blocage multi-couches, XP/guildes, musique, habits web, proof/trust, escrow). Chaque story est une brique dev pour Cursor.
>
> **Positionnement retenu : freelance-first.** Le fil rouge des concurrents qui retiennent = *boucle de progression visible* (recap → streak → digest → records) + *rituels* (planning matin / shutdown soir) + *le focus qui sert à se faire payer* (billable). C'est exactement l'angle Rize.io/Sunsama, et ça colle à ta cible.

---

## Priorisation (lire ceci en premier)

| Prio | Epic | Pourquoi maintenant | Effort |
|------|------|---------------------|--------|
| **P0** | E1 · Session Recap (carte post-session) | Le levier de rétention #1 de TOUS les concurrents. Data déjà là. | S |
| **P0** | E2 · Streaks & records | Manque le plus visible. Débloque le recap. | S |
| **P1** | E3 · Focus Score légitime (0-100) | `focus_score()` existe mais pas exposé comme "le chiffre à battre". | S |
| **P1** | E4 · Weekly digest (in-app + email) | Réactive les utilisateurs lapsés. Data hebdo déjà calculée. | M |
| **P1** | E5 · Billable / freelance layer | Ton pivot. Moat anti-churn (le focus = facturation). | L |
| **P2** | E6 · Rituels planning + shutdown | Le secret rétention Sunsama (73% à 6 mois). | M |
| **P2** | E7 · Réflexion & intentions (pré/post) | Cheap, transforme chaque session en artefact journalé. | S |
| **P2** | E8 · Social proof ambiant + share | "X focus avec toi" + page partageable = acquisition virale. | M |
| **P3** | E9 · Coworking 1:1 (Focusmate-like) | Anti-skip le plus fort, mais lourd. Après traction. | XL |
| **P3** | E10 · Auto-triggers focus (zones/calendar) | Automatise le démarrage. Dépend de l'intégration calendar. | M |
| **P3** | E11 · Distraction telemetry | "N fois tu as tenté d'ouvrir X" = report que presque personne n'a. | S |
| **P3** | E12 · Cross-surface task sync | Corrige le trou tasks desktop-only. Fondation. | M |

Taille : S ≈ 1-2j, M ≈ 3-5j, L ≈ 1-2 sem, XL ≈ 3+ sem.

---

## E1 — Session Recap (carte post-session) · **P0**

**Insight concurrent :** la carte recap de RescueTime empile 4 motivateurs sur UN écran au moment de satisfaction max : minutes vs objectif + distractions bloquées + streak + "X personnes ont focus avec toi". Sunsama fait pareil avec le shutdown ("voici tes wins"). C'est LA brique la plus rentable.

**Existant réutilisé :** `ActionNudge` (desktop, bas-droite), `focus_sessions` DB, `block_events`, `focus_score()`, `PomodoroEngine.session_finished`, XP economy.

- **E1-S1** — Modèle recap : à la fin d'un focus, agréger { minutes réelles vs prévues, focus_score de la session, nb de blocages tentés pendant la session, XP gagné, streak courant }. Endpoint `GET /api/sessions/[id]/recap`.
- **E1-S2** — Carte recap desktop (bas-droite, réutilise `ActionNudge`/nouvelle vue) affichée sur `session_finished`, même fenêtre fermée. Respecte `float_timer_enabled`. Boutons : Break / +10 / Encore une / Fermer.
- **E1-S3** — Carte recap web (dans `FocusOverlay`/`BlockTab`) au passage focus→break/idle. Skippable en 1 clic, jamais bloquante.
- **E1-S4** — "Value delivered" : toujours afficher un chiffre tangible ("le bouclier a tenu 3 fois"). Si 0 blocage, afficher "0 distraction, session propre" (bonus XP existant `clean session +15`).
- **E1-S5** — Question de clôture optionnelle "tu as fini ce que tu voulais ?" (oui/non) → alimente E7 et les stats.
- **E1-S6** — Réglage : recap après focus seulement, jamais après un break. Toggle "Session recap" dans Settings (comme `float_timer_enabled`).

---

## E2 — Streaks & records · **P0**

**Insight concurrent :** streak = don't-break-the-chain universel (Forest, Opal, Flow menu-bar, RescueTime). **Détail génial à copier : la streak ne compte que les JOURS OUVRÉS planifiés** → un week-end ou jour off ne casse pas la chaîne. Supprime la raison #1 d'abandon des streaks.

**Existant :** `soloStats.ts` calcule déjà un streak basique ; `points.ts` a un bonus 7 jours. À généraliser et exposer.

- **E2-S1** — Modèle streak serveur : jours consécutifs avec ≥1 session ou ≥ objectif focus. **Config "jours ouvrés"** (lun-ven par défaut, éditable) → les jours off ne cassent pas la streak.
- **E2-S2** — Streak visible partout : header web, tray tooltip desktop, carte recap (E1). Menu-bar/tray "🔥 12" façon Flow.
- **E2-S3** — Records personnels : plus longue streak, plus longue session, meilleur focus_score/jour, plus d'heures focus en 1 jour. Table `member_records`.
- **E2-S4** — Notif de célébration sur nouveau record ("Nouveau record : 4h focus aujourd'hui") via `notifications.py` + toast web.
- **E2-S5** — "Streak en danger" : si journée ouvrée sans session et il reste < 3h, nudge doux bas-droite ("garde ta série de 12 jours"). Anti-spam, 1×/jour.
- **E2-S6** — Milestones streak (7/30/100j) → badge + bonus XP (réutilise l'XP economy).

---

## E3 — Focus Score légitime (0-100) · **P1**

**Insight concurrent :** RescueTime "Productivity Pulse" et Opal "Focus Score" = UN chiffre 0-100 lisible, formule publiée, qu'on essaie de battre chaque jour, AVEC drill-down vers l'app coupable. `focus_score()` existe côté desktop mais n'est pas mis en scène comme "le chiffre".

**Existant :** `usage_tracker.focus_score()`, `app_usage` DB, `getWeeklyProductivity()`, catégories work/distraction/personal/neutral.

- **E3-S1** — Formule publiée et transparente (pondération 5 niveaux façon Pulse : Focus=100, Work=75, Neutral=50, Perso=25, Distraction=0). Documenter dans l'app ("comment est calculé ton score").
- **E3-S2** — Le score comme héros : gros chiffre 0-100 sur l'Overview web + tray desktop, avec flèche tendance vs hier ("+8 pts").
- **E3-S3** — Drill-down : cliquer le score → breakdown par niveau → apps/sites qui ont plombé (ranked, façon Productivity Report). Rend un mauvais score *actionnable* au lieu de honteux.
- **E3-S4** — "Beat yesterday" : comparaison systématique jour-1, semaine-1. Jamais de chiffre nu, toujours une tendance.
- **E3-S5** — Vue heure-par-heure / meilleur moment de la journée ("tu es du matin"). Curiosité = hook (cf. weekly email RescueTime).

---

## E4 — Weekly digest (in-app + email) · **P1**

**Insight concurrent :** l'email hebdo est LE réactivateur d'utilisateurs lapsés (RescueTime, Rize.io). Framé en *self-knowledge* ("tu es du matin", "tu galères le lundi") plutôt qu'en stats brutes. **Gap confirmé : aucun digest livré aujourd'hui, alors que toute la data hebdo est déjà calculée.**

**Existant :** `getWeeklyProductivity()` (focus_hours, sessions, avg_score, distraction, streak, habit_rate, OKRs), `AgendaPanel.tsx`, Brevo dispo (cf. autres projets).

- **E4-S1** — Vue "Weekly review" in-app (semaine : heures focus, score moyen, meilleur jour, top distraction bloquée, évolution vs S-1, progression OKR). Enrichir `AgendaPanel`.
- **E4-S2** — Insights self-knowledge auto ("meilleur jour = mardi", "meilleur créneau = 9-11h", "meilleure semaine depuis 3 semaines"). Génération heuristique (pas d'IA requise).
- **E4-S3** — Email hebdo (cron dimanche soir / lundi matin). Récap + 1 insight + CTA "planifie ta semaine". Réutiliser infra email.
- **E4-S4** — Digest partageable : image récap de la semaine (voir E8, X-friendly vu ta stratégie contenu).
- **E4-S5** — Opt-in/opt-out email dans Settings. Cadence configurable.

---

## E5 — Billable / freelance layer · **P1** (pivot)

**Insight concurrent :** Rize.io et RescueTime Solo+ et Toggl attachent le focus au *fait de se faire payer* → le plus fort anti-churn pour un freelance ("30h sur ce client, voici le résultat"). Rize vend "récupère 15-30% d'heures facturables perdues". C'est ton angle.

**Existant :** `tasks.py` (desktop, time_spent_seconds, estimate_minutes), `usage_tracker` (foreground app par client possible), `app_usage`. **Manque : projets/clients, taux, export.**

- **E5-S1** — Modèle Client / Projet / Tâche (DB + API). Rattacher une session focus et une tâche à un projet/client.
- **E5-S2** — Catégorisation semi-auto : mapper app/site/titre de fenêtre → client (règles éditables, façon Rize "Smart Fill Hints"). L'utilisateur confirme.
- **E5-S3** — Taux horaire par client + calcul du facturable par session/jour/semaine.
- **E5-S4** — Timeline du jour (blocs par app/tâche) + entrée manuelle pour réunions/appels hors écran (RescueTime "offline time" → total honnête).
- **E5-S5** — Export timesheet (CSV/PDF) par client/projet/période, prêt à facturer. C'est la brique qui rend l'app "load-bearing".
- **E5-S6** — Rapport de rentabilité : estimé vs réel par projet ("ce client mange ta marge") → aide à repricer.
- **E5-S7** — Sync bidirectionnelle Toggl (optionnelle) : offload analytics lourdes sans quitter l'app (façon Sunsama×Toggl).

---

## E6 — Rituels planning matin + shutdown soir · **P2**

**Insight concurrent :** Sunsama attribue ~73% de rétention à 6 mois au **rituel** (pas aux features) : wizard planning matin (5 P) + shutdown soir avec un "Done for the day" plein écran. Le rappel de shutdown EST le déclencheur de ré-engagement du lendemain.

**Existant :** habits web, tasks desktop, OKR panel, `AgendaPanel`. **Manque : les deux flows rituels.**

- **E6-S1** — Planning matin (wizard ~5 min) : reprendre les tâches non finies (carry-over explicite, rien ne roule en silence), choisir 3 priorités du jour, estimer le temps, définir l'objectif focus du jour.
- **E6-S2** — Workload meter : somme des estimations = charge du jour, passe jaune près du seuil soutenable, rouge si surchargé → pousse à *reporter*, pas à culpabiliser (le "calm productivity" de Sunsama).
- **E6-S3** — Shutdown soir (wizard ~2 min) déclenché par notif à heure fixe : revue des tâches finies, wins du jour, note 1-2 phrases, note de la journée, résolution des tâches restantes → écran "Terminé pour aujourd'hui".
- **E6-S4** — Objectif focus quotidien + jauge live (RescueTime "Daily Target") sur l'Overview et le tray.
- **E6-S5** — Rappel shutdown configurable = re-engagement trigger du lendemain.

---

## E7 — Intentions & réflexion (pré/post-session) · **P2**

**Insight concurrent :** Session et Focusmate imposent "sur quoi tu focus ?" AVANT et "qu'as-tu fait/appris ?" APRÈS. Transforme chaque session en record journalé, filtrable. Cheap, très collant (archive de wins = sunk-cost + identité).

**Existant :** description de tâche desktop, `tasks.py`, carte recap E1.

- **E7-S1** — Intention pré-session : champ "sur quoi tu bosses ?" (85 car. façon RescueTime) au démarrage du focus, optionnel mais encouragé.
- **E7-S2** — Réflexion post-session : "qu'as-tu accompli ?" dans la carte recap (E1), attaché à la session.
- **E7-S3** — Daily Highlights : logger ses wins en notes courtes ("15 appels", "inbox 0") → archive personnelle (RescueTime Premium).
- **E7-S4** — Journal filtrable : historique des sessions avec notes, filtrable (notes-only, par client/projet). Construit l'actif qui résiste au churn.

---

## E8 — Social proof ambiant + partage · **P2**

**Insight concurrent :** "X personnes focus avec toi en ce moment" (RescueTime) = multijoueur anonyme ambiant, pas besoin de graphe social, donne appartenance + accountability. La page/image de session partageable = acquisition virale + CTA "Try …". Forest "Plant Together" = stakes de groupe.

**Existant :** guildes/fellowship (déjà un graphe social réel !), leaderboards, feed_events.

- **E8-S1** — Compteur "N personnes focus maintenant" (global + dans ta guilde) affiché pendant la session et dans le recap. Cheap : compter les sessions actives serveur.
- **E8-S2** — Image/page de session partageable (minutes, distractions bloquées, streak, score) X-friendly + watermark app. Growth loop.
- **E8-S3** — Publier le shutdown/plan à la guilde (façon Sunsama→Slack) : coût social visible si tu skip le rituel.
- **E8-S4** — Focus de groupe synchronisé optionnel dans une guilde (Forest "Plant Together") : stakes partagés, réutilise l'escrow existant.

---

## E9 — Coworking 1:1 (body-doubling) · **P3**

**Insight concurrent :** Focusmate = rendez-vous vidéo avec un humain (25/50/75 min), objectif énoncé au début, check-in à la fin. L'anti-skip le plus fort du marché (énorme pour TDAH). Lourd à construire, à faire après traction.

- **E9-S1** — Matching de partenaires focus (dispo, durée) au sein de/entre guildes.
- **E9-S2** — Salle de session (vidéo légère ou juste présence + timer partagé), intention au début, check-in à la fin.
- **E9-S3** — Favoris + re-booking de bons partenaires.

---

## E10 — Auto-triggers de focus · **P3**

**Insight concurrent :** RescueTime démarre une session via tag calendrier `#focustime`, "Focus Zones" (créneaux libres 1h+), ou auto après 30 min de distraction. Le meilleur nudge est celui qu'on n'a pas à déclencher.

**Existant :** blocker `ScheduleRule[]` (jours + fenêtres), `usage_tracker` (détection distraction).

- **E10-S1** — Focus Zones : détecter les créneaux libres du calendrier (dépend intégration Google Calendar, déjà OAuth en place) → suggérer une session.
- **E10-S2** — Auto-session sur événement calendrier taggé `#focus`.
- **E10-S3** — Auto-offre de session après seuil de distraction (X min de distraction → "je lance 1h de focus ?").
- **E10-S4** — Sessions récurrentes cross-device (Freedom "block Insta chaque jour 7-9h") : étend `ScheduleRule` au démarrage auto de focus.

---

## E11 — Distraction telemetry · **P3**

**Insight concurrent :** Cold Turkey montre "combien de fois tu as tenté d'ouvrir chaque site bloqué" → confronte l'utilisateur à ses pires tentations. Report que quasi aucune app focus ne fait, et tu as DÉJÀ la data.

**Existant :** `block_events` DB, side-channel proxy, extension sweep/notify, personas block page.

- **E11-S1** — Agréger les tentatives par domaine/app/période ("ton top 3 des tentations cette semaine : X, Reddit, YouTube").
- **E11-S2** — Vue "tes tentations" dans le weekly digest (E4) + suggestion de resserrer la blocklist.
- **E11-S3** — Heatmap des tentations par heure (quand tu craques le plus) → suggérer d'y placer un blocage plus strict.

---

## E12 — Cross-surface task sync · **P3** (fondation)

**Gap confirmé :** les tâches sont desktop-only (JSON local, `tasks.py`), absentes du web et de l'extension. Fondation nécessaire pour E5 (billable) et E6 (rituels) qui s'appuient sur les tâches partout.

- **E12-S1** — API + DB tâches serveur (CRUD, parent_id, estimate, time_spent, projet/client de E5).
- **E12-S2** — Migrer `tasks.py` desktop vers l'API (garder cache local offline-first).
- **E12-S3** — UI tâches web (aujourd'hui absente) + habits desktop (aujourd'hui absentes) → parité cross-surface.

---

## Idées transverses à ne pas perdre

- **Recap au pic émotionnel** : toujours la carte recap au moment de satisfaction, jamais un dashboard froid.
- **Jamais de chiffre nu** : toujours une tendance/comparaison ("+8 vs hier", "meilleure semaine depuis 3 sem").
- **Jamais de honte** : mauvais score → "demain tu peux mieux", pas "échec". Ton *encourageant* explicite (Sunsama).
- **Streak = jours ouvrés seulement** : le repos ne casse pas la chaîne.
- **Freemium cohérent** : recap + streak + score = gratuit (le hook) ; billable/export + digest email + history longue = payant (façon RescueTime Solo/Solo+).
- **Le focus qui rapporte** : pour un freelance, l'export facturable est le vrai anti-churn — prioriser E5 dès que E1/E2 sont livrés.

---

## Ordre d'implémentation recommandé

1. **E2-S1/S2** (streak modèle + visible) — débloque le recap.
2. **E1** (recap complet) — le levier #1.
3. **E3** (focus score héros + drill-down).
4. **E4** (weekly digest in-app puis email).
5. **E5** (billable) — le pivot freelance, en profondeur.
6. Puis E6/E7 (rituels + réflexion), E8 (social/share), et les P3 selon traction.
