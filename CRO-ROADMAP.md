# CRO & product roadmap

## Live now (Railway + desktop)

| Step | Action |
|------|--------|
| 1 | **https://fellowship-focus-production.up.railway.app/download** — Windows CTA |
| 2 | Install desktop → Settings → paste invite / “Copy for desktop app” |
| 3 | Pomodoro **45 min** default (adjustable 1–120) + **Windows toasts** |
| 4 | Blocker tab → certificate once → Twitter/YouTube/TikTok blocked |

## Phase 2 — OKR automation

- Weekly OKR progress bar on Overview (focus hours vs target)
- Habit % vs OKR habit target
- Revenue field → dashboard KPI

## Phase 3 — Integrations (opt-in, privacy labels)

| Source | What we read | XP use |
|--------|--------------|--------|
| Google Calendar | Busy/free blocks, meeting count | “Deep work windows” bonus |
| Gmail | **Metadata only** (count, no body) | Outreach habit auto-check |
| Browser history | **Never raw URLs to guild** — local block log only | Block penalties already wired |

Inspired by [WorkTrace AI](https://github.com/priyanshuchawda/worktrace-ai) (local-first) and [Work Review](https://github.com/martinx/Work-Review) (per-app privacy).

## Release Windows .exe

```bash
git tag v1.2.0 && git push origin v1.2.0
```

GitHub Actions builds `FellowshipFocus-Windows.zip` → `/download` picks it up automatically.
