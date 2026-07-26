# Designs (Pencil)

## `fellowship-hud.pen`

Source of truth for the **cyber forge / premium HUD** visual language shipped in the web app.

Boards inside the file:

| Frame | Role |
|---|---|
| Variant A / Variant B | Focus tab composition proposals |
| Progress tab (stats) | Score, review, money layout |
| Settings + Notifications | Quiet hours, mute, toast geometry |
| Guild tab | Journey, ladder, feed |
| **HUD components (shipped)** | Reference geometry: bevelled TL/BR corners, hairline, ember accent, tabular figures. No neon, no glitch, no scanlines. |

Tokens in the pen (`$accent` `#b8422e`, `$panel` `#16171a`, `$hairline` `#2a2d31`, Cinzel + Inter) match `web/src/app/globals.css`.

Open with the Pencil extension. The live code (`.hud-panel`, `Charts.tsx`, `HudCard` desktop) is the implementation; this file is the composition reference for future screens.

Copy of the workspace-root `.pen` as of 26 July 2026.
