# Fellowship Focus — Chrome Extension (blocker)

A Manifest V3 extension that actually blocks distracting sites in the browser,
runs focus sessions, and syncs with your guild via the web app. It works
standalone (local block list) and gets stronger when connected.

## What it does

- **Blocking** — uses `declarativeNetRequest` dynamic rules to redirect blocked
  domains (and subdomains) to a branded block page. Fast, MV3-native, no
  per-request JS.
- **Shield toggle** — turn blocking on/off from the popup.
- **Focus sessions** — Pomodoro (focus/break/cycles from your prefs). The shield
  is force-locked during focus, and completed sessions are logged to the guild.
- **Guild sync** — pulls your block list + prefs from the web app; logs blocks
  (`/api/blocks`) and sessions (`/api/sessions`) so KPIs/OKRs update.
- **Offline-friendly** — if disconnected, it keeps a local default list.

## Load it (development)

1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the extension. Click it → **Settings**.
5. In the web app's **Block** tab, click **Connect extension**, then paste the
   copied code into the extension's Settings → **Connect**.

## Files

- `manifest.json` — MV3 config (declarativeNetRequest, storage, alarms).
- `background.js` — service worker: rules, sync, focus timer, logging.
- `popup.*` — shield toggle, focus session, today's stats.
- `options.*` — pairing + block-list management.
- `block.*` — the page shown when a site is blocked.
- `icons/` — generated from `desktop/assets/app-icon.png`.

## Notes

- Blocking targets `main_frame` navigations (the page you try to visit).
- The block list is capped at 4000 domains (DNR dynamic-rule limit headroom).
- Enforcement is per-browser. For system-wide blocking (all browsers/apps), the
  desktop app remains the strongest option; both read the same guild list.
