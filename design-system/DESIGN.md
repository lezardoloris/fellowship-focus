---
name: "Fellowship Focus"
category: Brands
surface: desktop
colors:
  background: "#1a1c1e"
  foreground: "#f4f4f5"
  accent: "#b8422e"
  surface: "#242628"
  muted: "#9ca3af"
  border: "#3a3d40"
  success: "#2d6a4f"
---

# Fellowship Focus

> Category: Brands  
> Surface: desktop Windows app

## Context

App Windows de productivité pour freelances et devs en guild (accountability sociale). Bloque les distractions (Twitter, YouTube Shorts, TikTok) pendant des sessions focus 45 min, track XP / habits / OKRs avec des amis — sans surveillance agressive.

**Surfaces primaires (desktop PySide6) :** Overview, Tasks, Focus (pomodoro), Blocker, Settings, plus un rail Fellowship web embarqué.  
**Surfaces web :** invite link, ladder guild, habit tracker, stakes.  
**Utilisateur :** dev/freelance 25–40 ans, Windows, veut un dashboard qui respire — Linear × Opal × Notion, pas un jeu.

Source repo : https://github.com/lezardoloris/fellowship-focus  
Evidence : `context/github/lezardoloris-fellowship-focus.md`  
Brief cible : `context/input-DESIGN.md` (redesign dark SaaS — le gold/LOTR legacy du code source est volontairement abandonné).

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Primary | `#1a1c1e` | page canvas, sidebar |
| foreground | Text | `#f4f4f5` | body text, headings, KPI values |
| accent | Tertiary | `#b8422e` | primary actions, active nav, timer ring |
| surface | Surface | `#242628` | cards and panels |
| muted | TextMuted | `#9ca3af` | secondary text, captions, inactive nav |
| border | Border | `#3a3d40` | rules, card borders, inputs |
| accent-secondary | Success | `#2d6a4f` | success states, positive hints |

Accent sparingly — high-signal only (CTA, active rail, focus ring). Never as a large wash.

## Typography

- **Display (brand only):** Cinzel 400/600 — wordmark sidebar `FELLOWSHIP / FOCUS` at 11px, letter-spacing 0.2em, color muted. Never on numbers or KPIs. Files: `fonts/Cinzel-Regular.ttf`
- **Body / UI:** Public Sans 400/500/600/700 — all UI, labels, values, buttons. Files: `fonts/PublicSans-Regular.ttf`
- Fallbacks: `system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif`

### Type scale

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| display | 11px | 600 | brand wordmark only |
| h1 | 20px | 600 | page title |
| h2 | 16px | 600 | section titles |
| body | 14px | 400 | nav, body, lists |
| kpi | 28px | 600 | KPI values (Public Sans, never serif) |
| caption | 12px | 400 | labels, hints, meta |

## Layout — Desktop Windows

- Sidebar fixe **200px**, fond background, pas de gradient
- Content max-width **960px**, padding **24px** (lg)
- Top bar **48px** : page title + 2 status pills max (guild · blocker)
- Radius **6px** (sm controls) / **10px** (cards)
- Border **1px** solid border
- Base spacing unit **4px** → xs 4 / sm 8 / md 16 / lg 24 / xl 32
- ZÉRO JSON, token, ou URL brute visible dans l’UI produit

## Components

### Sidebar
- Logo Cinzel 11px muted
- Nav Public Sans 14px, padding md, border-left 2px transparent
- Active : border-left accent, bg surface, text foreground
- Inactive : muted
- Footer version caption

### Card
- bg surface, border 1px border, radius 10px, padding lg
- Pas de hero image dans settings / blocker

### KPI Card
- Label caption uppercase muted
- Value Public Sans 28px semibold foreground
- Hint caption muted
- Thin progress bar under value (track border, fill accent or success)

### Button Primary
- bg accent, text foreground, radius 6px, padding 10px 20px
- Pas de gradient gold

### Button Ghost
- border 1px border, text foreground, bg transparent

### Focus timer
- Ring stroke accent, track border
- Time in Public Sans tabular (never Cinzel)
- Centered, minimal chrome

### Status pill
- height ~24px, radius 999, border 1px, bg surface, caption muted
- Success variant : success border/text

### Activity feed / composer (guild trust)
- Feed rows = session / block events (left border success or accent)
- Message-style rows for proofs; composer for quick note — never dump raw API payloads

## Motion

- Transitions 120–180ms ease on hover/active (nav, buttons, borders)
- Progress bars : width 400–800ms cubic-bezier(0.4, 0, 0.2, 1)
- Timer ring : continuous dashoffset, no bounce, no glow pulse
- Page stack : instant swap (desktop app), no full-page fade
- Prefer opacity/border-color over large transforms; respect reduced motion (disable non-essential animation)

## Voice

- **Tone :** calme, professionnelle, minimaliste, data-first
- **Pillars :** focus partagé · blocker honnête · accountability sans surveillance
- **Use :** session, focus, guild, blocker, OKR, habit, streak, classement
- **Avoid :** quest, Mordor, Ring Deposit, gold UI copy, fantasy ranks, dumps JSON/token/URL
- Labels courts, phrases factuelles, FR produit par défaut

## Anti-pattern

- Gold gradients, glass-gold borders, Cinzel on timer/KPI numbers
- Hero banners paysage / LOTR imagery in product chrome
- Empty decorative heroes above KPI rows
- Double sidebar or dual content rails
- JSON blobs, member tokens, raw API URLs visible in headers or forms
- Emoji as feature icons, purple gradient washes, full-width gold CTAs
- Serif anywhere except the 11px wordmark

## Posture rules

1. Charcoal canvas, one terracotta accent, generous whitespace
2. Numbers always sans-serif (Public Sans)
3. No gold, no fantasy copy, no empty hero banners
4. No debug JSON / tokens / raw URLs in product UI
5. Single sidebar, single content column — never double rail
6. Component kit roles: bg, surface, label, value, hint, border

## Source

- Repo: https://github.com/lezardoloris/fellowship-focus
- Evidence: `context/github/lezardoloris-fellowship-focus.md`
- Target direction supersedes legacy gold/LOTR theme in source (intentional redesign)
