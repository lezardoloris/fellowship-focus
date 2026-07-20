# Fellowship Focus — brand system (Heritage dark)

Generated from a single **seed** (`#b8422e` terracotta accent), refined toward
**Heritage** — ultra-minimal dark productivity UI (Linear × Opal × Raycast).

- **slug:** `fellowship-focus`
- **source:** https://github.com/lezardoloris/fellowship-focus
- **extends:** Heritage
- **mode:** dark-first
- **primary seed color:** `#b8422e`
- **themes:** default · dark · compact

## Heritage semantic tokens (dark)

| Token | Hex | Usage |
| --- | --- | --- |
| `colorBgLayout` | `#1A1C1E` | App background (not pure black) |
| `colorBgContainer` | `#242628` | Cards, panels |
| `colorBgElevated` | `#2E3134` | Inputs, elevated surfaces |
| `colorBorder` | `#3A3D40` | Borders, dividers |
| `colorText` | `#F4F4F5` | Primary text, KPI values |
| `colorTextSecondary` | `#9CA3AF` | Muted labels, captions |
| `colorPrimary` | `#B8422E` | CTA, focus ring, progress fill |
| `colorSuccess` | `#2D6A4F` | Success states, links |
| `colorWarning` | `#CA8A04` | Warning pills |

## Typography

- **UI (all controls, KPIs, timer):** Public Sans
- **Display only:** Cinzel 11px letter-spaced — logo "FELLOWSHIP FOCUS" only

## Component rules

- Primary button: flat `#B8422E`, white text, 6px radius — **no gold gradients**
- Ghost button: 1px `#3A3D40` border, transparent bg
- Card: `#242628` bg, `#3A3D40` border, 10px radius, 24px padding
- Input: `#2E3134` bg; token fields always masked
- Progress bar: 4px height, terracotta fill
- Sidebar: 200px; active nav = 2px left border tertiary + elevated bg

## UI prohibitions

- No raw JSON, API URLs, or tokens visible in UI
- No decorative hero banners on Settings, Blocker, Focus pages
- No full-width gradient buttons
- No gold (`#D4AF37`) except optional logo accent at 30% opacity max
- No Cinzel on KPI values, page titles, or timer numbers

## Files

| Path | What it is |
| --- | --- |
| `seed.json` | Effective seed snapshot |
| `tokens.default.json` | Light theme tokens |
| `tokens.dark.json` | Heritage dark tokens |
| `tokens.compact.json` | Compact density |
| `variables.css` | `:root{}` + `.dark{}` CSS custom properties |
| `variables.dark.css` | Standalone dark `:root{}` |
| `kit.html` / `kit.dark.html` | Component showcase |
| `artifacts/*.html` | Landing, deck, poster, email, etc. |

## Re-theme

Edit `brand.json` or `brand.json.seed`, then run `od brand finalize <brand-id>`.
Do not hand-edit `seed.json` — finalize regenerates downstream artifacts.
