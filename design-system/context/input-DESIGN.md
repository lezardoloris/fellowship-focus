---
name: Fellowship Focus
extends: Heritage
mode: dark-first
colors:
  primary: "#1A1C1E"
  surface: "#242628"
  surfaceElevated: "#2E3134"
  border: "#3A3D40"
  text: "#F4F4F5"
  textMuted: "#9CA3AF"
  accent: "#B8422E"
  success: "#2D6A4F"
  warning: "#CA8A04"
typography:
  ui: Public Sans
  display: Cinzel
platform: windows-desktop
---

Ultra-minimal productivity app. Block distractions during 45-min focus sessions.
Guild accountability (XP, habits, OKRs) without surveillance.

UI principles:
1. Data-first, no fantasy chrome in native app
2. Never expose tokens/JSON in UI
3. Terracotta accent, not gold
4. Public Sans for all metrics and controls
5. Cards with subtle borders, generous whitespace

## Layout — Desktop Windows

- Sidebar fixe 200px, fond primary, pas de gradient
- Content max-width 960px, padding lg
- Top bar 48px : page title + 2 status pills max (guild · blocker)
- ZÉRO JSON, token, ou URL brute visible

## Sidebar

- Logo : "FELLOWSHIP" / "FOCUS" en Cinzel 11px display, couleur textMuted
- Nav items : Public Sans 14px, padding md, border-left 2px transparent
- Active : border-left tertiary, bg surfaceElevated, text text
- Inactive : textMuted
- Footer : version en caption

## Components

### Card
- bg surface, border 1px border, radius md (10px), padding lg (24px)
- Pas de hero image dans les cards settings/blocker

### KPI Card
- Label caption uppercase
- Value : Public Sans 28px semibold, text (pas serif, pas gold)
- Hint caption

### Button Primary
- bg tertiary (#B8422E), text white, radius sm (6px), padding 10px 20px
- Pas de gradient gold

### Button Ghost
- border 1px border, text text, bg transparent

### Input
- bg surfaceElevated (#2E3134), border border, token fields always masked

### Progress bar
- 4px height, fill tertiary
