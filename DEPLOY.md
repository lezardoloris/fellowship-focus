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
| `AUTH_SECRET` | **yes** (prod) | Auth.js session secret (`NEXTAUTH_SECRET` also accepted) |
| `GOOGLE_CLIENT_ID` | for Sign in | Google OAuth client ID (`AUTH_GOOGLE_ID` alias OK) |
| `GOOGLE_CLIENT_SECRET` | for Sign in | Google OAuth client secret (`AUTH_GOOGLE_SECRET` alias OK) |
| `AUTH_URL` | recommended | Public site URL, e.g. `https://fellowship-focus-production.up.railway.app` |
| `DATA_DIR` | optional | SQLite folder — mount a volume here for persistence |
| `GITHUB_CLIENT_ID` | optional | GitHub OAuth (Focus coding track) |
| `GITHUB_CLIENT_SECRET` | optional | GitHub OAuth secret |
| `GITHUB_TOKEN` | optional | PAT for public Events rate limits |
| `ESCROW_API_KEY` | optional | Escrow.com API key (goal bets) |
| `ESCROW_EMAIL` | optional | Escrow broker account email |
| `ESCROW_WEBHOOK_KEY` | optional | Shared secret for `/api/escrow/webhook?key=` |
| `ESCROW_SANDBOX` | optional | `1` = sandbox API |
| `CRON_SECRET` | optional | Protects `/api/cron/settle-stakes?key=` (falls back to webhook key) |

### Escrow webhook (goal bets)

In Escrow.com → API / webhooks, point to:

`https://YOUR_HOST/api/escrow/webhook?key=YOUR_ESCROW_WEBHOOK_KEY`

Funded status flips only after Escrow secures payment (not on “Deposit” click).

Sunday auto-settle (Railway cron or external):

`GET https://YOUR_HOST/api/cron/settle-stakes?key=CRON_SECRET`

Google Console redirect URI and full steps: [docs/GOOGLE-OAUTH-SETUP.md](docs/GOOGLE-OAUTH-SETUP.md).

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
