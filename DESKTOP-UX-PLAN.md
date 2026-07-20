# Fellowship Focus Desktop — UX Plan

> Dashboard Windows au petit oignon — parité web, productivity loop guildes, OKRs freelance, paris Escrow.

---

## Principes

| Principe | Implémentation |
|----------|----------------|
| **Non intrusif** | Tray par défaut, démarrage Windows minimisé, toasts discrets bas-droite |
| **Certificat permanent** | Install une fois → toujours prêt (mitmproxy CA dans Windows Root) |
| **Premium, pas webcodé** | Cinzel + DM Sans, glass cards, images hero, or LOTR |
| **Productivity loop** | KPI → OKR → Guild ladder → Stakes → Focus session → repeat |

---

## Architecture UI

```
┌──────────────┬────────────────────────────────────────────┐
│  SIDEBAR     │  CONTENT (stacked pages)                   │
│              │                                            │
│  Dashboard   │  [Hero image + KPIs + OKRs + Ladder]       │
│  Tasks       │  [Koncentro-style task tree]               │
│  Pomodoro    │  [Timer + journey + blocker auto]          │
│  Blocker     │  [31 sites + cert status permanent]        │
│  Guild       │  [API, OKRs, startup, stakes link]         │
└──────────────┴────────────────────────────────────────────┘
                                    ┌─────────────────┐
                                    │ Toast bas-droite │
                                    └─────────────────┘
```

---

## Pages

### 1. Dashboard (home)
- Hero `journey-map.jpg`
- **4 KPIs** : Focus today, Weekly net XP, Habits %, Streak
- **OKRs hebdo** (style PERSO.xlsx + STRAT) :
  - Focus hours (cible 20h)
  - Habit completion (cible 80%)
  - Freelance revenue (cible €/mois)
- **Guild ladder** top 5 + journey waypoint
- **Ring Deposit** — lien vers stakes Escrow sur le web
- CTA : Start Focus Quest / Open Web Dashboard

### 2. Tasks
- Hiérarchie, time tracking, play → Pomodoro

### 3. Pomodoro
- Hero `focus-quest.jpg`, timer Cinzel, phases work/break
- Blocker auto pendant work intervals

### 4. Blocker
- Liste 31 domaines (Twitter, YouTube, Pornhub, TikTok…)
- Certificat : **Permanent** une fois installé
- Sous-domaines matchés (`m.youtube.com`, etc.)

### 5. Guild
- API URL + token + code Fellowship
- OKR targets configurables
- ☑ Start with Windows (minimized)
- ☑ Minimize to tray

---

## Notifications (toasts)

| Event | Toast |
|-------|-------|
| App start + cert OK | "Shield armed" |
| Cert manquant | "Certificate needed" |
| Pomodoro done | "+XP Quest complete" |
| Settings saved | "Guild settings updated" |
| Block page hit | (via web API → feed) |

Position : **bas-droite**, empilés, fade in/out 4s.

---

## Certificat — permanent

1. `mitmproxy-ca-cert.cer` dans `~/.mitmproxy/`
2. Import dans `Cert:\CurrentUser\Root`
3. Vérif au boot → toast "Shield armed"
4. **Jamais** redemander si déjà installé (Koncentro users : skip)

---

## Productivity Loop (guildes)

```
Rejoin Fellowship (/f/code)
    ↓
Set OKRs (focus h, habits %, revenue €)
    ↓
Daily: Pomodoro + habits grid (web) + blocker
    ↓
Weekly: Ladder net XP + habit score
    ↓
Optional: Ring Deposit €5–50 (Escrow)
    ↓
Sunday: winners split pot / losers forfeit
```

### Vérification paris

| Tier | Poids |
|------|-------|
| Auto (focus, zero blocks) | 100% |
| Manuel (sport, pas de joint) | 80% |
| Peer proof (Phase 3) | 100% si validé |

---

## Fonts

Télécharger une fois :
```bash
cd desktop && python scripts/download_fonts.py
```

Fichiers dans `desktop/assets/fonts/` :
- Cinzel-Regular.ttf, Cinzel-Bold.ttf
- DMSans-Regular.ttf, DMSans-Medium.ttf, DMSans-Bold.ttf

Fallback Windows : Georgia + Segoe UI.

---

## Roadmap desktop

- [x] Dashboard KPI + OKR + ladder
- [x] Toasts bas-droite
- [x] Startup Windows
- [x] Cert permanent messaging
- [x] Theme premium (glass, gold)
- [ ] Habits grid native (embed webview ou Qt table)
- [ ] Stakes UI native (Escrow fund from desktop)
- [ ] Windows toast notifications (Action Center)
- [ ] Installer `.exe` (PyInstaller)

---

## Freelance OKR exemple (ton PERSO)

| OKR | Cible | Track |
|-----|-------|-------|
| Focus | 20h/sem | Pomodoro sessions |
| Prospection | 20 Looms/j | Manual habit |
| Clients | 3 × €1000/mois | Revenue OKR field |
| Habits | 80% | Web habit grid |

La guilde voit le ladder — la pression sociale + l'argent en jeu = Cold Turkey × Duolingo × Escrow.
