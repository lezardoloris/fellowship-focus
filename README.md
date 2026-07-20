# Fellowship Focus

> Duolingo for deep work. One link. March to Mordor with friends.

## Two parts

| Part | What | Chrome needed? |
|------|------|----------------|
| **`web/`** | Fellowship dashboard, invite link, ladder, map | No |
| **`desktop/`** | Koncentro-style system-wide blocker + Pomodoro | **No** |

The **desktop app** uses the same technique as Koncentro:
- **mitmproxy certificate** (the "contract" you install once)
- **System proxy** during focus sessions
- Blocks sites in **all browsers**, not just Chrome

## Quick start

### Web dashboard
```bash
cd web && npm install && npm run dev
```
Open http://localhost:3000 → create Fellowship → share link → join with friends

### Desktop blocker (no extension)
```bash
cd desktop && pip install -r requirements.txt && python main.py
```

1. **Certificate** tab → install mitmproxy cert (skip if you already did for Koncentro)
2. **Settings** → API URL + member token + Fellowship code
3. **Begin Quest** → system-wide blocking + XP sync

See [desktop/README.md](./desktop/README.md) and [PLAN.md](./PLAN.md).
