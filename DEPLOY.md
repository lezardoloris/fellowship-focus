# Deploy Fellowship Focus (Railway / Railpack)

## Problem

The repo is a **monorepo** (`web/`, `desktop/`, `extension/`). Railpack at repo root only sees markdown files and fails.

## Fix (choose one)

### Option A — Root Directory `web` (recommended)

In Railway → **fellowship-focus** → **Settings** → **Root Directory** → set to:

```
web
```

Redeploy. Railpack detects Next.js automatically.

### Option B — Build from repo root

Root `package.json` + `railway.toml` delegate build/start to `web/` (no Root Directory change).

**Do not** override Railpack `install` steps in `railpack.json` — that skips copying `package.json` into the image.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | auto | Set by Railway |
| `DATA_DIR` | optional | SQLite folder — mount a volume here for persistence |
| `ESCROW_API_KEY` | optional | Escrow stakes |
| `ESCROW_EMAIL` | optional | Escrow broker email |
| `ESCROW_SANDBOX` | optional | `1` for sandbox |

## Persistent SQLite (important)

By default `web/data/fellowship.db` is **ephemeral** — wiped on redeploy.

1. Railway → service → **Volumes** → Add volume
2. Mount path: `/app/web/data` (if root dir = `web`) or `/app/data`
3. Set `DATA_DIR=/app/web/data` (match mount path)

## Public URL

After deploy: **Settings** → **Networking** → **Generate Domain**

Desktop app: set API URL to `https://your-app.up.railway.app`

## Local test (production build)

```bash
cd web
npm ci && npm run build && npm start
```
