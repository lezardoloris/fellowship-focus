# Fellowship Focus Extension — Epics & Stories

Backlog for developing the Chrome extension (drive this in Cursor). Format:
epic → user stories → acceptance criteria. Reuse the Playwright harness
`scratchpad/accept_edge.py` pattern for acceptance where possible.

Status legend: [x] done · [~] in progress · [ ] todo

---

## EPIC 1 — Publish to the Chrome Web Store
Goal: any non-technical user installs in one click.

- [x] **1.1** As a reviewer, I can see a single-purpose extension with minimal
      permissions. → `history` is `optional_permissions`; base manifest holds
      only what blocking needs.
      _AC:_ manifest `permissions` has no `history`; blocking still passes
      `accept_edge.py` 19/19.
- [x] **1.2** As the developer, I have a copy-paste submission kit.
      _AC:_ `store/PRIVACY.md`, `PERMISSIONS.md`, `STORE-LISTING.md`,
      `SUBMIT.md` exist and are current.
- [x] **1.3** As the developer, I can produce an upload zip in one command.
      _AC:_ `node web/scripts/pack-extension.mjs` outputs a zip with no
      `store/`, `.md`, `.pem`, and with the dev `key` stripped.
- [ ] **1.4** As a user, I can read the privacy policy at a public URL.
      _AC:_ `/privacy` renders and matches `store/PRIVACY.md`; linked from the
      Store listing.
- [ ] **1.5** As the developer, I submit and pass review.
      _AC:_ item approved; `NEXT_PUBLIC_CHROME_STORE_URL` set; `/extension`
      shows "Add to Chrome".

## EPIC 2 — Web ↔ extension interconnection (interchangeable)
Goal: the web app and the extension find and drive each other reliably.

- [x] **2.1** As the web app, I talk to the extension over a direct channel.
      _AC:_ `externally_connectable` set; `chrome.runtime.onMessageExternal`
      handles `getStatus`; bridge prefers direct, falls back to postMessage.
- [x] **2.2** As the web app, I keep working after the Store changes the id.
      _AC:_ extension id discovered at runtime from `FF_EXT_READY.extId`; no
      hardcoded id.
- [x] **2.3** As a user in the desktop shell, I never see "install extension".
      _AC:_ `isDesktopShell()` (UA marker) suppresses the browser fallback.
- [ ] **2.4** As a user, the web pill shows "Extension linked · vX" when present.
      _AC:_ BlockTab status reflects `getExtensionState()` incl. version.
- [ ] **2.5** As a user, changing the shield in the popup updates the web app.
      _AC:_ within ~5 s the web pill reflects a popup toggle (poll + FF_EXT_READY).

## EPIC 3 — User-facing options (edit without the web app)
- [ ] **3.1** Options page edits block list, allowlist, schedules, page/notify.
- [ ] **3.2** Per-site mode (hard / friction / notify) from the list.
- [ ] **3.3** Import/export the block list as JSON.
      _AC:_ round-trip export→import reproduces the list.

## EPIC 4 — Onboarding after install
- [ ] **4.1** First run opens a 3-step guide (pin it, pick a preset, arm).
- [ ] **4.2** If a Fellowship tab is open, auto-offer to link it.
- [ ] **4.3** Empty-state block list suggests common distractions.

## EPIC 5 — Browser parity
- [ ] **5.1** Firefox port (WebExtensions + DNR), MV3.
      _AC:_ same acceptance suite passes under Firefox.
- [ ] **5.2** Edge listing (Chromium — mostly repackage).

---

## Done this pass
1.1, 1.2, 1.3, 2.1, 2.2, 2.3 landed. Next: 1.4/1.5 (privacy page live + submit),
2.4/2.5 (linked-state UI + popup→web reflection).
