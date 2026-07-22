# Fellowship Focus — Privacy Policy

_Last updated: 2026-07-22_

Fellowship Focus is a website blocker and focus timer. It is built to protect
your attention, not to collect your data.

## What the extension does NOT do

- It does **not** sell, rent, or share your data with anyone.
- It does **not** run analytics or advertising trackers.
- It does **not** read the content of the pages you visit.
- It does **not** send your browsing history anywhere.

## What data is handled, and where it stays

**Stored only on your device (chrome.storage.local):**
- Your block list, allow list, schedules, and preferences.
- Local focus/session counters and daily block counts.

This never leaves your browser.

**Sent only to the Fellowship server you choose to connect (optional):**
If, and only if, you connect the extension to a Fellowship account (a "guild"),
the extension sends the minimum needed to power your shared accountability:
- A block event when a blocked site is prevented (the domain and your member
  token), so your guild XP/ladder can update.
- Focus session completions (duration).

If you never connect a guild, nothing is sent to any server.

## Permissions and why they are needed

- **declarativeNetRequest** — redirect distracting sites to the block page.
- **webNavigation** — block a site the instant navigation starts.
- **tabs** — redirect tabs that were already open when the shield turns on.
- **browsingData** — clear the cached service worker of a blocked site so it
  cannot serve an offline shell.
- **storage / alarms / notifications** — save your settings, run the timer,
  and show the optional "-XP" notification.
- **host access (all sites)** — you decide which sites to block; the extension
  must be able to act on any site you add.
- **history (optional)** — only requested if you tap "Scan history" to find
  your most-visited distractions. Analyzed locally; never uploaded. You can
  decline and everything else keeps working.

## Your control

- Everything is off until you turn the shield on.
- You can disconnect a guild at any time from the extension.
- Uninstalling the extension removes all locally stored data.

## Contact

Questions: privacy@fellowshipfocus.app
