# Fellowship Focus — Design System

Dark productivity design system for the Fellowship Focus Windows desktop app.

## Product Overview / Product Context

Fellowship Focus is a Windows productivity app for freelancers and developers who work in a guild. It blocks distractions (Twitter, YouTube Shorts, TikTok) during 45-minute focus sessions and tracks XP, habits, and weekly OKRs with friends — without aggressive surveillance.

**Primary surfaces**

| Surface | Role |
| --- | --- |
| Overview | KPI row, weekly OKRs, guild ladder, live focus ring |
| Tasks | To-do list + start focus on selected task |
| Focus | Pomodoro timer (45 / 10), terracotta ring |
| Blocker | Certificate + blocked site rules |
| Settings | Guild identity + weekly targets |
| Web invite | Fellowship link, ladder, HabitTracker, stakes |

**Visual direction:** Linear × Opal × Notion — charcoal UI, terracotta accent, Public Sans, generous whitespace. Intentionally **not** the legacy gold / LOTR theme still present in older source screenshots.

**Audience:** devs & freelancers 25–40 on Windows who want a calm dashboard, not a game.

## Source / context references

- Repository: https://github.com/lezardoloris/fellowship-focus
- Intake evidence: `context/github/lezardoloris-fellowship-focus.md`
- Snapshots: `context/github/lezardoloris-fellowship-focus/files/`
- Canonical brief: `context/input-DESIGN.md`
- Authoritative tokens: `DESIGN.md` + `colors_and_type.css`
- Source components preserved: `source_examples/` (`FellowshipDashboard.tsx`, `HabitTracker.tsx`, `theme.py`, `main_window.py`, `globals.css`)

## Package contents

| Path | Purpose |
| --- | --- |
| `DESIGN.md` | Canonical design rules (context, color, type, layout, motion, voice, anti-pattern) |
| `colors_and_type.css` | CSS custom properties + utilities + local `@font-face` |
| `fonts/` | Cinzel + Public Sans TTF bound by the CSS |
| `brand.json` / `guide.md` | Brand kit metadata |
| `preview/` | Focused review cards |
| `ui_kits/app/` | Runnable desktop shell (React components) |
| `desktop-overview.html` | Standalone product Overview prototype |
| `source_examples/` | High-signal original source |
| `build/` | Runtime icons (`icon.png`, `logo.png`, `icon.ico`) |
| `logos/` / `assets/` | Brand marks and legacy screenshot references |
| `context/` | Intake evidence and notes |

## Preview Manifest

| Card | File | Source labels |
| --- | --- | --- |
| Typography specimens | `preview/typography-specimens.html` | Cinzel wordmark, Public Sans scale |
| Colors primary | `preview/colors-primary.html` | 7-role palette |
| Spacing tokens | `preview/spacing-tokens.html` | 4px base, radius, shell |
| Components buttons | `preview/components-buttons.html` | buttons, pills, nav, timer |
| Components KPI | `preview/components-kpi.html` | FellowshipDashboard / DashboardPage |
| Components habits | `preview/components-habits.html` | HabitTracker |
| Brand assets | `preview/brand-assets.html` | build/ + logos/ |
| Desktop shell | `ui_kits/app/index.html` | full composed app |
| Product Overview | `desktop-overview.html` | shipping product prototype |

## Preserved assets / fonts / build

- `fonts/Cinzel-Regular.ttf`, `fonts/PublicSans-Regular.ttf` (bound in `colors_and_type.css`)
- `build/icon.png`, `build/logo.png`, `build/icon.ico`
- `logos/favicon.png` (+ alternates)
- Legacy UI screenshots under `assets/` for before/after reference only

## UI kit

See `ui_kits/app/README.md`. Entry `ui_kits/app/index.html` loads `../../colors_and_type.css`, React 18.3.1, and composes Sidebar, TopBar, KpiRow, OkrPanel, FocusRing, GuildPanel, ChatArea, MessageBubble, InputBar, App.

## Reuse / review workflow

1. Read `DESIGN.md` then bind `colors_and_type.css` (local fonts required).
2. Open preview cards in order: colors → type → spacing → components → brand-assets.
3. Run the shell: `ui_kits/app/index.html` or product `desktop-overview.html`.
4. Match layout: sidebar 200px, top bar 48px, content max 960px, KPI row of 4.
5. Keep Cinzel for the wordmark only; all numbers in Public Sans.
6. Never reintroduce gold gradients, fantasy copy, hero banners, or raw JSON/tokens.
7. For new screens, ship one HTML file per view under semantic names.
8. Domain modules to restyle from source: `FellowshipDashboard`, `HabitTracker`, `StakesPanel`, `TrustPanel`, desktop `main_window` / `dashboard`.

## Themes

Product UI is **dark-only** (`#1a1c1e` canvas). The generated `system/` folder may contain light algorithmic themes from the brand engine — prefer root tokens for product work.
