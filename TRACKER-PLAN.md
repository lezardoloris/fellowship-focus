# Tracker PERSO → Fellowship Focus

Inspiré de `PERSO.xlsx` (onglet **🗓 Template**) : grille habits × jours, colonnes **Goal** / **Achieved**, partagée entre potes avec ladder et paris Escrow.

---

## Ce que PERSO.xlsx fait

| Onglet | Rôle | Dans Fellowship Focus |
|--------|------|----------------------|
| **🗓 Template** | Habits en lignes, jours 1–31 en colonnes, Goal/Achieved | `HabitTracker` — même grille |
| **Quotidien** | Blocs horaires (prospection, sport, deep work) | Desktop Pomodoro + tasks |
| **STRAT** | Objectifs 90j + planning type | Journey map + waypoints LOTR |
| **Compta** | Revenus / projets priorisés | Hors scope (perso finance) |

### Habits importés depuis ton Excel

- Wake up before 8am 🌄
- 10 min meditation ⛩
- Read 1h or 10 pages 📚
- Listen 1 podcast 💡
- Sport 💪
- 10 produits/j 📦
- Pas de joint 🚫 / Pas de cigarette 🚭
- Parler dans le miroir 🪞
- Formation business / Apprendre le code
- **Focus quest ≥25 min** ⚔️ — auto (desktop)
- **Zero distraction day** 🛡️ — auto (blocker)

---

## 3 niveaux de vérification (pour parier sans tricher)

| Tier | Type | Exemple | Poids stakes |
|------|------|---------|--------------|
| **Auto** | Serveur vérifie | Focus ≥25 min, 0 block page | 100% |
| **Manual** | Tu coches, potes voient | Sport, méditation, pas de joint | 80% |
| **Peer** (Phase 3) | Photo / validation pote | Habitudes sensibles | 100% si confirmé |

### Auto-vérifié (impossible à faker sans bypass certificat)

```
focus-quest  → focus_sessions WHERE minutes >= 25 AND completed
clean-focus  → focus_sessions today AND block_events today = 0
```

### Manuel (honor system + transparence groupe)

- Check-in = +5 XP
- Visible dans le feed : "Aragorn checked in: Sport (+5 XP)"
- Tes potes voient ta grille sur le dashboard

---

## Double ladder

### 1. Weekly XP ladder (focus + blocks)

```
weekly_net = session_xp − block_penalties
```

Leagues : Mordor / Gondor / Rohan / Shire

### 2. Habit ladder (mensuel, style PERSO)

```
completion_rate = achieved / goal (par habit)
stake_score = moyenne pondérée (auto × 1.0, manual × 0.8)
```

Classement visible par tout le Fellowship — idéal pour les paris.

---

## Paris Escrow — "Ring Deposit"

### Règles par défaut

| Condition | Résultat |
|-----------|----------|
| stake_score ≥ 70% | ✅ Winner |
| block_events > 5 / semaine | ❌ Forfeited |
| Entre les deux | ⚠️ Partial (50% récupéré) |

### Flow

```
1. Un pote ouvre "Ring Deposit" (5–50€/personne)
2. Chacun entre son email → lien Escrow.com
3. La semaine : habits + focus trackés auto
4. Dimanche : evaluateStakeOutcomes() → winner / partial / forfeited
5. Escrow release vers les gagnants (Phase 2b : webhook auto)
```

### Config Escrow (réutilise CessionPro)

```env
# web/.env.local
ESCROW_API_KEY=...
ESCROW_EMAIL=...
ESCROW_SANDBOX=1   # pour tester
ESCROW_SANDBOX_EMAIL=...
ESCROW_SANDBOX_KEY=...
```

---

## Points XP habits

| Action | XP |
|--------|-----|
| Check-in manuel (1 jour) | +5 |
| Objectif mensuel atteint | +30 (à venir) |
| Semaine parfaite habits | +15 (à venir) |

S'additionne au ladder XP focus.

---

## API

| Route | Usage |
|-------|-------|
| `GET /api/habits?token=&year=&month=` | Grille mensuelle |
| `POST /api/habits` | Ajouter preset PERSO |
| `POST /api/habits/checkin` | Toggle jour manuel |
| `GET /api/stakes?fellowship=` | Pari actif |
| `POST /api/stakes` | create / fund |

---

## Tester

```bash
cd fellowship-focus/web && npm run dev
# → http://localhost:3000
# Crée Fellowship → rejoins → grille habits + ladder + stakes
```

Desktop (focus auto) :

```bash
cd fellowship-focus/desktop && python main.py
# Colle token → Pomodoro 25 min → focus-quest se coche auto
```

---

## Roadmap

- [x] Grille PERSO (habits × jours, goal/achieved)
- [x] Presets depuis ton Excel
- [x] Auto-sync focus + clean day
- [x] Habit ladder groupe
- [x] Stakes Escrow (create + fund)
- [ ] Webhook Escrow settlement auto (dimanche)
- [ ] Peer proof (photo habit sensible)
- [ ] Import direct PERSO.xlsx (upload)
