# Guild Trust — preuves de focus (privacy-first)

Inspiré d’Upwork (capture périodique), WorkTrace AI et OWASP BLT Fresh — mais **privacy by default**.

## Niveaux de partage

| Mode | Ce qui est envoyé | Visible par la guilde |
|------|-------------------|------------------------|
| **off** | Rien | — |
| **signal** (défaut) | App active, horodatage, “en focus” | ✅ métadonnées seulement |
| **blur** | Miniature 320px floutée + app | ✅ vignettes floues (stakes) |
| **full** | 640px (opt-in explicite) | ✅ accountability totale |

## Webcam (optionnelle)

- Jamais de flux vidéo continu.
- Snapshot 160×120, flou fort, **visage/presence seulement** si activé.
- Stockage 7 jours max, supprimable par le membre.

## Rythme

- Pendant Pomodoro **work** uniquement.
- Intervalle configurable : **5 / 10 / 15 min** (défaut 10).

## Stockage

- Railway : `DATA_DIR/proofs/` (volume persistant).
- Pas d’analytics tiers ; hébergement sur ton instance Railway.

## Références open source

- [WorkTrace AI](https://github.com/priyanshuchawda/worktrace-ai) — preuves locales + rédaction
- [Work Review](https://github.com/martinx/Work-Review) — anonymize par app
- [OWASP BLT Fresh](https://github.com/OWASP-BLT/BLT-Fresh) — classification sans upload d’image
