# GitHub OAuth setup (coding track)

Fellowship Focus can show **commits / PRs / reviews** on the Focus tab and (when linked to a guild member) award soft XP + auto-check the **Ship ≥1 commit** habit.

## Env vars

| Variable | Required | Notes |
|----------|----------|--------|
| `GITHUB_CLIENT_ID` | for Connect button | Or `AUTH_GITHUB_ID` |
| `GITHUB_CLIENT_SECRET` | with ID | Or `AUTH_GITHUB_SECRET` |
| `GITHUB_TOKEN` | optional | Server PAT for public rate limits (`GITHUB_PAT` alias) |
| `AUTH_SECRET` | yes (prod) | Shared with Google / Auth.js |
| `AUTH_URL` | recommended | Public site URL |

Callback:

```text
{AUTH_URL}/api/auth/callback/github
```

Check: `GET /api/auth/providers-status` → `{ "github": true, ... }`.

## GitHub App (OAuth App) checklist

1. [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers) → **New OAuth App**
2. Application name: `Fellowship Focus`
3. Homepage URL: your `AUTH_URL`
4. Authorization callback URL: `{AUTH_URL}/api/auth/callback/github`
5. Copy Client ID + generate Client Secret → Railway / `.env.local`
6. Scope used by the app: **`read:user`** (identity + authenticated Events API)

## How tracking works

1. User clicks **Connect GitHub** (OAuth) and/or enters a username.
2. `GET /api/github/activity?user=…&token=<memberToken>` fetches Events (private if OAuth matches).
3. Responses are **cached ~10 min** and **rate-limited** per IP.
4. With a guild `token` + OAuth match, activity is stored in SQLite (`github_users`, `github_activity_daily`), soft XP is capped (`GITHUB_DAILY_XP_CAP`), and `auto_github` habits check in.
5. Blocker allowlists `github.com` + `githubusercontent.com` (extension + desktop mitm skip).

## Local test

```bash
cd web
# add GITHUB_CLIENT_ID / SECRET to .env.local
npm run test:github
npm run dev
```

Open Focus tab → Connect GitHub → Sync.
