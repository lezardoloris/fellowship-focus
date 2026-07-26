# Cursor prompt — finish the HUD migration (H2 → H6)

*Paste everything below the line into Cursor (Composer, agent mode, repo root = `fellowship-focus/`).*

---

You are working in the **Fellowship Focus** monorepo: a Next.js 16 / React 19 / Tailwind 4 web app (`web/`), a PySide6 Windows desktop app (`desktop/`) that renders the web app inside a `QWebEngineView`, and a Chrome MV3 extension (`extension/`).

Read `PLAN-HUD.md` first. It is the source of truth for this task. Do not restate it back to me — implement it.

## What is already done (do not redo)

Commit `c7a9957` shipped H0 and H1:

- `augmented-ui@2.0.0` is installed and imported at the top of `web/src/app/globals.css`.
- `.hud-panel` exists in `globals.css` (notched silhouette via `data-augmented-ui`, corner ticks via `::after`, `--aug-*` custom properties). `.hud-num` gives tabular figures.
- `.premium-panel` radius is now 6px, applied globally.
- `web/src/components/Charts.tsx` exports `BarSeries`, `HeatBars`, `Sparkline`, `TrendArea`, and a dark `ChartTooltip`. `BarSeries` accepts `showBaseline` (default true), `showGrid`, `highlightIndex`, `renderLabel(point, index)`, `formatter`, `emptyLabel`, `tone`, `baseTone`.
- `web/src/components/FocusTab.tsx` uses `BarSeries` for the focus calendar and the 8-week history; `WeekPanel` and `LadderCard` use `.hud-panel`.

## The problem you are fixing

`Charts.tsx` was written and then imported in only 1 of 37 components. The app still hand-rolls bar charts in several places with per-component percent-of-max maths, `title=` attributes instead of tooltips, and no empty states. Your job is to finish wiring it and to apply the mockup layout to the remaining tabs.

**A story is not done because the file exists. It is done when it is imported and rendered.** Before you claim a story complete, run the grep in "Verification" and check the call count went up.

## Visual register — non-negotiable

"Cyber forge", not neon cyberpunk. This app is Tolkien-themed (leagues named Shire, Rohan, Gondor, Mordor). Keep the ember accent `--accent: #b8422e`. Take the *geometry* of the futurist look: bevels, corner ticks, thin dashed grids, tabular figures, glow on the single active value only.

**Forbidden**: cyan/magenta neon, glitch effects, animated scanlines, CRT flicker. Users stare at this screen for 50-minute stretches; motion in the chrome becomes noise. Also forbidden: any hex colour inside a chart — pass a tone name (`accent`, `success`, `danger`, `warning`, `muted`) which resolves to a token.

## Tasks

### H2 — Progress tab · P1

Files: `web/src/components/FellowshipDashboard.tsx`, `TemptationsPanel.tsx`, `Panel.tsx`, `AgendaPanel.tsx`.

1. Reorder to the mockup: focus score + weekly review side by side, then the money panel full width, then the rest.
2. `StatTile` (in `Panel.tsx`) gains an optional `history?: number[]` prop rendering a `Sparkline` under the figure. Wire it wherever a series is available. This fills the empty space currently sitting under the big "52" focus score.
3. `TemptationsPanel` hand-rolled bars → `HeatBars`.
4. `AgendaPanel` day bars → `BarSeries`.
5. Finish the de-duplication: an earlier audit counted `streak` rendered 4× on one screen; 2 were removed. Find the rest (`grep -rn "streak" web/src/components`) and leave exactly one owner.

Acceptance: no hand-rolled bar markup left in the Progress tab; `streak` appears once; every `StatTile` with a series shows a sparkline.

### H3 — Guild tab · P1

File: `web/src/components/GuildDirectory.tsx` (456 lines), `GuildJourney.tsx`.

1. Weekly ladder → horizontal `BarSeries`, with the current user's row highlighted via `highlightIndex`.
2. Journey → connected dots for the steps.
3. Activity feed → compact `.hud-panel` cards.

Acceptance: my own position in the ladder is identifiable at a glance without reading names.

### H4 — Settings (web) · P2

File: `web/src/components/SettingsPanel.tsx`.

The desktop backend already stores `quiet_hours_start`, `quiet_hours_end`, `notifications_muted_until` — the web exposes none of it. Add the UI and persist through the existing prefs endpoint used by the rest of `SettingsPanel`.

Acceptance: muting from the web is reflected in the desktop app through the same prefs endpoint. Do not invent a new endpoint.

### H5 — Notifications · P2

Web: align the 4 notification types (session recap, critical block, nudge, streak danger) to the HUD geometry.

Desktop (this is Qt, not CSS — `QPainterPath`, not a stylesheet): `desktop/fellowship_focus/ui/action_nudge.py`, `session_nudge.py`, `toast.py`, `session_recap.py`. Give them clipped corners and the same colours as the web tokens.

Do **not** change notification *timing or policy*. The suppression rules in `desktop/fellowship_focus/notifications.py` (quiet hours, global mute, 1/hour cap, 4h snooze, BLOCK never suppressed) were tuned deliberately after the user reported nudges being too intrusive. Style only.

Acceptance: a desktop notification and its web twin are recognisable as the same product.

### H6 — Verification

Run these and paste the real output. Do not summarise as "all good".

## Verification

```bash
cd web
npx tsc --noEmit
AUTH_SECRET="local-build-check-only-0123456789" npx next build
# Count chart-layer call sites — this number MUST go up.
grep -rn "from \"@/components/Charts\"" src | wc -l
# Must return nothing by the end:
grep -rn "style={{ height: \`" src/components
```

```bash
cd ../desktop
py -3.12 -m pytest tests -q
```

## Gotchas that will waste your time

- **`npm run build` fails locally** on a `check-audio-size.cjs` guard: ~26 mp3 files up to 334 MB sit in `web/public/audio/`. They are gitignored and never deployed — the guard protects the Railway deploy, not compilation. Use `npx next build` directly.
- **`next build` needs `AUTH_SECRET`**, otherwise page-data collection throws. Use the dummy value above; never commit a real one.
- **Import path is `@/components/Charts`**, not `./Charts`. Grepping for the relative form returns nothing and will make you think the layer is unused.
- **Next.js 16 has breaking changes** vs older training data. `web/AGENTS.md` says: read the relevant guide in `node_modules/next/dist/docs/` before writing app-router code.
- **Do not touch** `desktop/fellowship_focus/ui/web_dashboard.py`. Its load watchdog and retry ordering were just fixed after a black-screen bug; the retry must return *before* the watchdog is stopped.
- Windows shell: this repo is developed on Windows. PowerShell has no `&&`.

## Style rules for this repo

- Comments explain *why*, referencing the story tag (e.g. `[HUD-H2]`), never *what* the line does.
- No em dashes or en dashes in any user-visible copy. Use a comma, a period, parentheses, or a plain hyphen. Numeric ranges use a plain hyphen ("2-5 days").
- Every chart needs an empty state that says *why* it is empty.
- `isAnimationActive={false}` on every Recharts series: these panels refresh every 15-60s and the entry animation makes them shiver.

## Commit

One commit per story (H2, H3, H4, H5), message in English, explaining the *why* and the measured before/after (e.g. "call sites 3 → 9", "removed 2 of 3 scaling formulas"). End each message with:

```
Co-Authored-By: Cursor <noreply@cursor.com>
```

Push to `master` when the verification block above passes. If a story turns out to be blocked, finish every other story in full and say explicitly what you left out and why.
