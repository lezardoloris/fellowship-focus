# Guild card illustrations

Compact PNGs for guild directory cards (mapped by niche in `web/src/lib/assets.ts`).

| File | Guild / niche |
| --- | --- |
| `students.png` | Rohan Study Hall |
| `builders.png` | The Shire Builders |
| `fitness.png` | Fellowship of Sweat |
| `deep-work.png` | Mordor Deep Work |
| `accountability.png` | Council of Accountability |
| `creators.png` | Gondor Creators |

## Regenerate with Gemini

Requires `GEMINI_API_KEY` (see `web/.env.example`). Same loader pattern as `generate-assets.mjs` / `generate-icon.mjs`.

```bash
cd web
npm run generate-guild-illustrations
# overwrite existing:
npm run generate-guild-illustrations -- --force
```

If Gemini quota/billing is unavailable, muted crops from existing cinematic brand assets may be checked in as interim art; `--force` replaces them with freshly generated Gemini illustrations.
