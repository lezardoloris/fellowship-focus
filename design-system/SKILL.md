---
name: fellowship-focus
description: Dark Windows productivity design system for Fellowship Focus — charcoal UI, terracotta accent, Public Sans, guild focus sessions.
user-invocable: true
---

# Fellowship Focus design system skill

## What is inside

- `DESIGN.md` — rules, palette, type, layout, components
- `colors_and_type.css` — tokens and base utilities
- `preview/` — small HTML review cards
- `ui_kits/app/` — composed desktop shell
- `source_examples/` — original components from the GitHub repo
- `build/` — app icons
- `README.md` — package overview and preview manifest

## Source context

Extracted from https://github.com/lezardoloris/fellowship-focus (desktop PySide6 + web Next.js). Product direction is a **redesign** away from gold/LOTR toward Linear-style dark SaaS, per `context/input-DESIGN.md` and user brief.

## When to use this skill

Use when designing or building Fellowship Focus screens, marketing for the same product, or any UI that must match this brand: Overview, Tasks, Focus timer, Blocker, Settings, guild ladder, habits, OKRs.

## How to use

1. Open `README.md` for structure and preview list.
2. Bind tokens from `colors_and_type.css` (or paste equivalent `:root` from `DESIGN.md`).
3. Match shell from `ui_kits/app/index.html` and `desktop-overview.html`.
4. Inspect `source_examples/` for domain modules (sessions, habits, blocker rules) — restyle, do not copy gold theme.
5. Ship semantic filenames per screen; keep French product copy unless asked otherwise.

## Design system highlights

- Background `#1a1c1e` · Surface `#242628` · Text `#f4f4f5` · Muted `#9ca3af` · Border `#3a3d40` · Accent `#b8422e` · Success `#2d6a4f`
- Display: Cinzel (wordmark only) · Body: Public Sans (including KPI numbers)
- Sidebar 200px · top bar 48px · content max 960px · radius 6–10px
- Forbidden: gold, fantasy, empty heroes, JSON/token/URL dumps, serif on numbers, double sidebar
