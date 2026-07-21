# Focus soundscapes (web player)

Drop ambient `.mp3` loops here and list them in `manifest.json` so the Player tab
picks them up. These are the same soundscapes used for the long-form focus videos
(see `content-studio/`).

`manifest.json` format:

```json
[
  { "title": "Rivendell Nights", "src": "/audio/rivendell.mp3", "ip": "LOTR" },
  { "title": "Arrakeen Keep", "src": "/audio/arrakeen.mp3", "ip": "DUNE" }
]
```

Notes:
- Keep files reasonably small (loop 3–10 min; the player loops a single track).
- Users can also paste a track URL directly in the Player tab (stored locally).
