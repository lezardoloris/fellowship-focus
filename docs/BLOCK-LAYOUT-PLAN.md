# Block tab — fluid / movable layout plan

**Date:** 2026-07-23  
**Scope:** Block tab panels only (Timer · Block list · Focus music) + shared chrome typography that breaks at zoom.  
**Not this plan:** full Guild/Focus tab redesign (one-liner in §6).

---

## 0. Current state (inspection)

| Surface | What it does today | Pain |
|--------|---------------------|------|
| `BlockTab.tsx` main grid | `lg:grid-cols-2` then `xl:grid-cols-[0.85fr_1.25fr_0.9fr]` — Timer \| Block \| Music | Uneven columns; at `lg` Music drops under Timer → tall left stack + empty cherry-blossom void on the right |
| Timer panel | Fixed `text-[3.25rem]` digits; preset chips `text-[11px]`; 3-col steppers | Digits/chips jump awkwardly at 80%/125% zoom; dense chip row wraps badly |
| Block list | `min-h-[22rem]` / `max-h-[min(70vh,34rem)]`; header = dual segmented controls + presets + category chips + search | Chip/header row gets cramped; list is primary but visually equal-weight with siblings |
| `FocusMusicPanel.tsx` | Full `glass-panel` with large centered play (h-16) + title + select | Too tall when stacked beside timer; wastes vertical space |
| `FocusApp.tsx` header | `flex-wrap` brand + tabs + BlockerMode + auth | Same max-w-6xl; wraps into awkward multi-line chrome at high zoom |
| Layout prefs | **None** — localStorage has blocklist / timer prefs / session / music track only | No way to “move the boxes” |
| Float timer (desktop) | Capsule shows **time + accent dot only** (no phase word in paint). Web still sends `label: "FOCUS"\|"BREAK"` for dot color | If UI still shows the word “FOCUS”, running binary is stale → **restart desktop app** |

Root cause of the void: CSS auto-placement fills columns top-to-bottom. Two short left panels + one tall right panel leave a large empty band over the scene. Zoom amplifies fixed `px` chips (`text-[10px]`/`[11px]`) and fixed rem-ish digit stacks that don’t share a fluid measure.

---

## 1. Goals

1. **Rearrange boxes** — user can change which panel sits where (at least swap Timer ↔ Music; optionally promote Block list full-width). Persist choice in `localStorage`.
2. **Fluid responsive** — one composition that fills the content column; no giant empty glass voids; panels stretch to shared row heights where useful.
3. **Zoom-resilient typography** — prefer `rem` / `clamp()`; avoid brittle `text-[10px]`/`[11px]` stacks for UI chrome; keep chips readable and tappable at 80% / 100% / 125%.
4. **Block list remains primary** — largest visual + interaction weight; session controls (timer + music) are secondary support.
5. **Smallest system that feels movable** — no masonry freestyle unless we later prove need.

Acceptance north star: at desktop webview and browser, 80–125% zoom, the first Block viewport reads as one calm composition: session tools compact, block list dominant, scene visible *around* panels not *through a hole between them*.

---

## 2. Recommended layout model (pick ONE)

### Primary: **CSS Grid named areas + saved panel order**

**What**

- Define a small set of **layouts** (not free pixel dragging):
  - `session-top` (default) — row 1: Timer + Music compact; row 2: Block list full width  
  - `session-side` — Block list main column; Timer+Music stacked in a side rail  
  - `classic-3` — Timer \| Block \| Music equal `1fr` columns (optional escape hatch for power users)
- Implement with `grid-template-areas` + a tiny order map in state, e.g.:

```ts
// localStorage key: ff-block-layout-v1
type BlockLayoutId = "session-top" | "session-side" | "classic-3";
type PanelId = "timer" | "block" | "music";
// For classic-3 / session-side: which panel occupies which named area
type AreaAssignment = Record<"a" | "b" | "c", PanelId>; // constrained permutations
```

- **Move UX (P1):** lightweight “Rearrange” control — drag handles *or* “Move left / right / up” on panel headers — that only permutes **named slots**, not arbitrary x/y. No new dependency.
- Persist `{ layoutId, areas }` in `localStorage`; migrate with versioned key.

**Why this vs alternatives**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Named areas + saved order (chosen)** | Tiny; CSS-native; zoom-safe; matches “move boxes” without pixel math; easy reset | Not freeform resize/drag to arbitrary positions | **Best fit** |
| Fixed **2-row only** (no save) | Fastest fix for voids | Doesn’t satisfy “move as we want” | Use as **default**, not the whole system |
| **react-grid-layout / dnd-kit masonry** | True freeform | Heavy; fights browser zoom; breakpoints + `vh`/`px` collisions; overkill for 3 panels | Reject for P0–P1 |

**Principle:** three panels → discrete layouts + slot swap beats a general-purpose dashboard grid.

---

## 3. Zoom / text strategy

### What breaks today

- Arbitrary Tailwind pixel sizes: `text-[10px]`, `text-[11px]`, `text-[15px]` float, timer `text-[3.25rem]` with no clamp.
- Chip clusters (presets, categories, Whole sites / List only, Block page / Notify) share one header row → wrap into tall awkward stacks at ≥125% or narrow desktop webview.
- Music panel uses fixed visual mass (`h-16` play) that doesn’t compress in a side-by-side session strip.
- Block list `min-h-[22rem]` forces height even when content is small, exaggerating asymmetry.

### Strategy

1. **Root / content measure**
   - Keep `max-w-6xl` on shell + Block content (already aligned with `FocusApp`).
   - Prefer readable line length inside Block list: site chips wrap inside a panel with `max-w` inherited from grid, not a third competing column at zoom.

2. **Timer digits**
   - Replace fixed size with something like:  
     `font-size: clamp(2rem, 4vw + 1rem, 3.25rem)` (or Tailwind arbitrary `text-[clamp(...)]`).
   - Keep `tabular-nums` + `leading-none`.

3. **Chips / labels**
   - Minimum chip text ≈ `0.75rem` (12px at default root), not `10px`/`11px`.
   - Use `text-xs` / `text-[0.75rem]` consistently; allow wrap with `gap-1.5` and **secondary chip rows** that collapse under a “More” disclosure at narrow widths (P1).
   - Touch target: `min-h-[2rem]` on segmented controls.

4. **Container queries (optional, P1)**
   - On Block list panel: `@container` → when panel width &lt; ~28rem, stack scope/hit toggles vertically or move presets under a single “Presets” popover.
   - Avoid media-query-only fixes that ignore the panel’s actual width after rearrange.

5. **Session strip compact mode**
   - Music: horizontal row (play · title truncate · volume) instead of centered album-art posture when `layoutId === "session-top"` or when container is short.
   - Timer in strip: digits + Start/Pause/Stop on one band; presets/steppers collapsible when in session.

6. **Do not** scale the whole app with JS zoom hacks; rely on rem + clamp so OS/browser zoom remains the user control.

---

## 4. Default arrangement

**Recommended default: `session-top`**

```
┌──────────────────────────── max-w-6xl ────────────────────────────┐
│  ┌──────────── Timer (compact) ─────┐  ┌── Music (compact) ──┐   │
│  │  digits · presets · Start/Stop   │  │ play · track · vol  │   │
│  └──────────────────────────────────┘  └─────────────────────┘   │
│  ┌──────────────────── Block list (primary, full width) ───────┐ │
│  │  scope · hit · presets · categories · search · site chips   │ │
│  │  min height from content; grow with viewport, scroll inside │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Why better than current uneven 3-col**

- Eliminates the left-stack / right-void composition over the scene.
- Makes Block list the clear hero (full width).
- Timer + Music share one “session” job (start focus + soundtrack).
- Equal stretch within the session row (`1fr 1fr` or `1.1fr 0.9fr`); music stays compact so it doesn’t dominate.

**Fallback default if we must keep three columns:** equal `1fr 1.4fr 1fr` with **`items-stretch`**, music in compact horizontal variant, and Block list `min-h` lowered — still inferior to `session-top` for the void problem.

---

## 5. Phased implementation

### P0 — Default composition + type floor (no rearrange UI yet)

**Intent:** Kill the void and unreadable chips without shipping a layout editor.

| Files | Changes |
|-------|---------|
| `web/src/components/BlockTab.tsx` | Replace `lg/xl` uneven grid with `session-top` CSS grid areas; extract Timer / Block list into clear subtrees (or keep inline but area-tagged); drop aggressive `min-h-[22rem]` or reduce; chip text → `text-xs` / rem |
| `web/src/components/FocusMusicPanel.tsx` | Add `compact?: boolean` (or `variant="strip" \| "panel"`) for horizontal session-row layout |
| `web/src/app/globals.css` | Optional utility: `.ff-timer-digits { font-size: clamp(...) }`; chip min font tokens if useful |
| `web/src/components/FocusApp.tsx` | Light touch only if header wrap fights Block at 125% (e.g. slightly tighter gaps / allow brand hide earlier) — keep changes minimal |

**Acceptance checks**

- [ ] 100% zoom, desktop width: session row + full-width Block list; no large empty panel-sized void beside Music.
- [ ] 125% zoom: timer digits still fit session card; chips wrap without overlapping controls; Block list remains tallest/most prominent.
- [ ] 80% zoom: panels don’t look sparse/orphaned; music strip still usable.
- [ ] Desktop webview (Qt): same layout; Start/Pause still drives float capsule.
- [ ] Float capsule shows time + dot only (no “FOCUS” word). If word appears → **fully quit & relaunch** desktop app (UI already paint-less for phase text; stale process likely).

### P1 — Movable boxes (named slots) + persistence

| Files | Changes |
|-------|---------|
| `web/src/lib/blockLayout.ts` (new) | Types, defaults, `readBlockLayout` / `writeBlockLayout`, validate permutations |
| `web/src/components/BlockTab.tsx` | Apply `layoutId` + area map to `grid-template-areas`; small “Layout” menu: Session top · Side rail · Three columns · Reset |
| Optional: panel header buttons “Swap with …” | Enough to feel “move boxes”; full drag optional |
| `FocusMusicPanel.tsx` | Compact vs panel follows area (side rail → stacked compact; classic → compact or medium) |

**Acceptance**

- [ ] Choosing layout persists across reload (`ff-block-layout-v1`).
- [ ] Swap Timer/Music updates areas without remounting session state (timer keeps running).
- [ ] All three layouts pass 80/100/125% zoom checks above.
- [ ] Reset restores `session-top`.

### P2 — Polish / container queries / drag handles

- `@container` on Block list header for chip overflow → disclosure.
- Optional HTML5 / pointer drag between named slots (still snap to areas — not freeform).
- Soften Music when idle (collapse to one-line “Focus music · Play”).
- Align any leftover `text-[Npx]` in Block-only chrome to rem tokens.
- Document layout key in Settings → “Reset Block layout” if Settings already has a misc section.

**Acceptance**

- [ ] Narrow desktop webview (~900 CSS px) still usable without horizontal scroll.
- [ ] Drag (if shipped) never leaves a panel off-screen or overlapping.

---

## 6. Out of scope

- **Guild / Focus tabs** — do not redesign layouts here; only reuse shared tokens (`.glass-panel`, rem chip floor) if P0 touches `globals.css`.
- Freeform resize, nested grids, multi-monitor window chrome.
- Rewriting blocker / session / alarm logic.
- Shipping `react-grid-layout` or similar.
- Scene / ImmersiveScene changes (void is a panel-placement issue, not a background issue).

---

## 7. Float timer “FOCUS” note

Desktop `FloatTimerWindow` already renders **only** `●` + `mm:ss` + dismiss; phase string is stored for accent color / tray, not painted as a word.

If a screenshot still shows **FOCUS** text on the float pill:

1. Confirm local tree matches that paint path (`desktop/fellowship_focus/ui/float_timer.py` — no phase `QLabel`).
2. **Fully quit** Fellowship Focus (tray quit, not only close window) and relaunch so Qt loads the new UI.
3. Web may still send `label: "FOCUS"` via `desktopBridge.showFloatTimer` — that is intentional for status color; it should not appear as visible copy after restart.

---

## 8. Success criteria (product)

- User can rearrange Block panels among a small set of sensible layouts and have it stick.
- Layout feels fluid: session tools compact, Block list primary, scene reads as backdrop not empty hole.
- Text and chips stay legible and operable from 80%–125% browser zoom in desktop webview and Chrome.
- Implementation stays small: CSS grid + localStorage + one compact music variant — no dashboard grid library.
