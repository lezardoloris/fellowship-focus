# Google OAuth setup (Sign in)

Fellowship Focus uses **Auth.js / NextAuth v5** with the Google provider. Sign-in only works when Google client credentials are set on the server.

**Share** and **Leave** do **not** use Google OAuth. They appear after you join a guild (`code` + member `token` in the browser). Sign-in is independent; configure OAuth below so **Sign in** works.

## Env names the code expects

| Variable | Required | Notes |
|----------|----------|--------|
| `GOOGLE_CLIENT_ID` | yes (for Sign in) | Or alias `AUTH_GOOGLE_ID` |
| `GOOGLE_CLIENT_SECRET` | yes (for Sign in) | Or alias `AUTH_GOOGLE_SECRET` |
| `AUTH_SECRET` | yes (production) | Already used for JWT/session; `NEXTAUTH_SECRET` also accepted |
| `AUTH_URL` | recommended | Canonical public URL, e.g. production Railway URL |

Callback path (fixed by Auth.js):

```text
{AUTH_URL}/api/auth/callback/google
```

Check a deployment: `GET /api/auth/providers-status` → `{"google":true,...}` when configured.

---

## 1. Google Cloud Console checklist

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select or create a project.
2. **APIs & Services** → **OAuth consent screen**
   - User type: **External** (or Internal for Workspace-only).
   - App name: `Fellowship Focus` (or your brand).
   - Support email + developer contact: your email.
   - Scopes: only the defaults Auth.js uses — **openid**, **email**, **profile** (no Gmail/Drive).
   - Add test users while the app is in **Testing**.
3. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Name: `Fellowship Focus Web`

### Authorized JavaScript origins

| Environment | Origin |
|-------------|--------|
| Local | `http://localhost:3000` |
| Production | `https://fellowship-focus-production.up.railway.app` |

Add any custom domain the same way (`https://your.domain`).

### Authorized redirect URIs

| Environment | Redirect URI |
|-------------|--------------|
| Local | `http://localhost:3000/api/auth/callback/google` |
| Production | `https://fellowship-focus-production.up.railway.app/api/auth/callback/google` |

Custom domain: `https://your.domain/api/auth/callback/google`

4. Create → copy **Client ID** and **Client secret** (do not commit them).

---

## 2. Railway variables

In Railway → **fellowship-focus** → **Variables**, set:

```text
GOOGLE_CLIENT_ID=<paste Client ID from Google Cloud>
GOOGLE_CLIENT_SECRET=<paste Client secret from Google Cloud>
AUTH_URL=https://fellowship-focus-production.up.railway.app
```

Keep existing `AUTH_SECRET` (or `NEXTAUTH_SECRET`). Redeploy after saving.

Optional aliases (same values): `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### Local env file (under `web/`)

Create `web/.env.local` (gitignored) with:

```text
AUTH_SECRET=<long random string>
GOOGLE_CLIENT_ID=<paste Client ID>
GOOGLE_CLIENT_SECRET=<paste Client secret>
AUTH_URL=http://localhost:3000
```

Generate a secret: `openssl rand -base64 32`

---

## 3. Verify

1. Redeploy Railway (or restart `npm run dev`).
2. Open `https://fellowship-focus-production.up.railway.app/api/auth/providers-status` → `"google": true`.
3. Open `/app` → **Sign in** → Google consent → return to `/app` signed in.

If Sign in still fails: confirm redirect URI matches **exactly** (https, no trailing slash on origin, path `/api/auth/callback/google`).
