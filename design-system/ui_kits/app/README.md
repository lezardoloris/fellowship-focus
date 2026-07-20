# UI kit — Fellowship Focus desktop

Runnable shell matching the Windows desktop app layout (Overview-first).

## Structure

```
ui_kits/app/
  index.html              # browser entry — React + Babel + tokens
  components/
    App.jsx               # composes full shell + routes
    Sidebar.jsx           # 200px nav (Overview Tasks Focus Blocker Settings)
    TopBar.jsx            # title + guild/blocker pills
    KpiRow.jsx            # 4 KPI cards (FellowshipDashboard parity)
    OkrPanel.jsx          # weekly OKRs + thin bars
    FocusRing.jsx         # terracotta timer ring
    GuildPanel.jsx        # ladder top 5
    ChatArea.jsx          # activity feed shell (TrustPanel role)
    MessageBubble.jsx     # session / block rows
    InputBar.jsx          # composer for session notes
```

## Component roles

| Role | File |
| --- | --- |
| App shell | `App.jsx` |
| Sidebar / navigation | `Sidebar.jsx` |
| Top chrome | `TopBar.jsx` |
| Chat area / feed | `ChatArea.jsx` |
| Message bubble | `MessageBubble.jsx` |
| Input bar / composer | `InputBar.jsx` |
| Domain widgets | `KpiRow`, `OkrPanel`, `FocusRing`, `GuildPanel` |

## Usage workflow

1. Open `index.html` in the Open Design preview pane (or any local server).
2. Components assign `window.ComponentName`; `App` mounts on `#root`.
3. Navigate via sidebar — Overview shows KPI + OKR + guild + activity feed + timer.
4. Reuse a single component by loading its `.jsx` after React/Babel and the shared CSS.
5. For static product export without React, prefer root `desktop-overview.html`.

## Design notes

- Tokens from `../../colors_and_type.css` (local fonts under `../../fonts/`)
- Charcoal canvas `#1a1c1e`, surface `#242628`, accent `#b8422e` only on active rail / primary CTA / ring
- Public Sans for all numbers; Cinzel wordmark only
- No gold, no fantasy copy, no JSON dumps in chrome
- Radius 6–10px, 1px borders, base spacing 4px

## Source basis

| Kit piece | Source evidence |
| --- | --- |
| Shell / nav | `desktop/.../ui/main_window.py` |
| KPI + OKR | `desktop/.../ui/dashboard.py`, `web/.../FellowshipDashboard.tsx` |
| Habits domain | `web/.../HabitTracker.tsx` |
| Theme tokens (legacy gold rejected) | `desktop/.../ui/theme.py`, `web/.../globals.css` |
| Trust / feed | `web/.../TrustPanel.tsx` |
| Target direction | `context/input-DESIGN.md` |
