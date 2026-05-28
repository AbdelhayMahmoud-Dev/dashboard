# Deployment Guide

End-to-end instructions for safely pushing this project to GitHub and deploying:

- **Backend** → Render (Node web service)
- **Frontend** → Vercel (Next.js)

Read everything before you push. The pre-flight checklist exists because once a secret hits a public GitHub history, rotating it is the only safe fix.

---

## 1. Pre-flight: what gets committed vs what doesn't

### Safe to commit ✓

| Path | Why it's safe |
|---|---|
| `backend/src/**`, `frontend/src/**` | Source code — no hardcoded secrets (audited) |
| `backend/.env.example`, `frontend/.env.example`, `.env.example` | Variable shape only, no values |
| `backend/.gitignore`, `frontend/.gitignore` | Defence-in-depth ignore rules |
| `backend/package.json`, `frontend/package.json`, lockfiles | Reproducible installs |
| `backend/tsconfig.json`, `frontend/tsconfig.json` | Build config |
| `backend/Dockerfile`, `backend/.dockerignore` | Container build |
| `docker-compose.yml`, `docker-compose.dev.yml` | Local dev orchestration |
| `DEPLOYMENT.md`, `README.md` | Docs |

### Never commit ✗

| Path | Why |
|---|---|
| `backend/.env` | Real JWT_SECRET, MONGODB_URI, COOKIE_SECRET |
| `frontend/.env.local` | NEXT_PUBLIC_* values (env-specific) |
| `backend/uploads/**` (except `.gitkeep`) | User-uploaded content (PII risk) |
| `node_modules/` | Reproduced from lockfile |
| `backend/dist/`, `frontend/.next/`, `frontend/out/` | Build output |
| `*.tsbuildinfo`, `next-env.d.ts` | Generated build artifacts |
| `*.log`, `logs/` | Runtime data |
| `*.pem`, `*.key`, `*.crt`, `secrets/`, `service-account*.json` | Credentials |
| `.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/` | OS / editor noise |

All of the above are already in the hardened `.gitignore` files in `backend/` and `frontend/`.

---

## 2. Push to GitHub safely

### Step 1: Initialize git at the project root

```powershell
cd C:\Users\user\OneDrive\Desktop\Dashboard
git init
git branch -m main
```

### Step 2: Pre-commit verification (CRITICAL)

Before your first `git add`, **prove no secrets will be staged**:

```powershell
# This should list everything that *would* be tracked. Scan it for .env or uploads/.
git status --untracked-files=all

# Specifically verify .env files are ignored. Each of these MUST output:
#   "Ignored by ..."
git check-ignore -v backend/.env
git check-ignore -v frontend/.env.local
```

If `git check-ignore` returns nothing for either file, **stop**. The `.gitignore` is not catching it. Fix the gitignore before continuing.

### Step 3: First commit

```powershell
git add .
git status   # final review — scan for any .env or uploads/* files
git commit -m "Initial commit"
```

### Step 4: Create the repo and push

Create the repo on GitHub (web UI), then:

```powershell
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### Step 5: Post-push verification

Open the repo on GitHub. Use the file browser to confirm:

- `backend/.env` does **not** appear
- `frontend/.env.local` does **not** appear
- `backend/.env.example` **does** appear with empty values only
- `backend/uploads/` shows only `.gitkeep`

If you see any actual secret file: **immediately rotate every secret** (regenerate JWT_SECRET, change MongoDB password, etc.) and delete the file with `git rm --cached`. Don't just remove it from the latest commit — GitHub keeps history.

---

## 3. Deploy backend to Render

### Step 1: Create a managed MongoDB

Render's own MongoDB add-on is fine for getting started; for anything serious use MongoDB Atlas (free tier available). Either way, **note the connection string** — you'll paste it into `MONGODB_URI`.

Atlas quick path:
1. Create cluster
2. Database Access → add user with read/write
3. Network Access → allow `0.0.0.0/0` (or specifically Render's egress IPs)
4. Copy connection string (`mongodb+srv://...`)

### Step 2: Generate production secrets

Do **not** reuse your local `.env` values. Generate fresh ones:

```powershell
# JWT secrets (run twice — one for JWT_SECRET, one for JWT_REFRESH_SECRET)
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# Cookie secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Save these somewhere safe (password manager). The env validator in `backend/src/config/env.ts` will reject placeholder strings like `change_me` or `dev_*` in production — this is intentional.

### Step 3: Create the Render web service

In Render dashboard → **New +** → **Web Service** → connect your GitHub repo.

Service settings:

| Field | Value |
|---|---|
| **Name** | `saas-dashboard-backend` (or your choice) |
| **Region** | Closest to your users |
| **Branch** | `main` |
| **Root directory** | `backend` |
| **Runtime** | Node |
| **Build command** | `npm ci && npm run build` |
| **Start command** | `npm start` |
| **Health check path** | `/health` |
| **Instance type** | Free for testing; Starter ($7/mo) for anything real (Free spins down after 15 min idle) |

### Step 4: Add environment variables

In the Render service → **Environment** tab → add each variable below.

**Required:**

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | The Atlas/Render connection string from step 1 |
| `JWT_SECRET` | Freshly generated (step 2) — min 32 chars |
| `JWT_REFRESH_SECRET` | Freshly generated (step 2) — must differ from JWT_SECRET |
| `COOKIE_SECRET` | Freshly generated (step 2) |
| `CLIENT_URL` | Your Vercel frontend URL — e.g. `https://your-app.vercel.app` (comma-separated if multiple) |

**Optional (set if used):**

| Variable | When to set |
|---|---|
| `JWT_EXPIRE` | Override default `15m` |
| `JWT_REFRESH_EXPIRE` | Override default `7d` |
| `REDIS_URL` | Set if you've added a Render Redis add-on |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Set if using Cloudinary for product image uploads |

**Don't set:**
- `PORT` — Render injects this automatically. Setting it manually will break the bind.

### Step 5: Deploy

Click **Create Web Service**. Render will:
1. Clone the repo
2. Run `npm ci && npm run build` in `backend/`
3. Run `npm start`
4. Probe `/health` every 30s

First deploy takes ~3–5 minutes. Watch the build logs.

### Step 6: Verify backend deployment

Open `https://your-service.onrender.com/health` in a browser. You should see:

```json
{ "status": "ok", "timestamp": "...", "uptime": 12.34, "environment": "production", "version": "1.0.0" }
```

Also check `/health/detailed` to confirm MongoDB is connected:

```json
{ "status": "healthy", "dependencies": { "database": { "status": "connected", "healthy": true } } }
```

If `status: "degraded"`, MongoDB isn't reachable — check `MONGODB_URI` and Atlas network allowlist.

---

## 4. Deploy frontend to Vercel

### Step 1: Import project

In Vercel dashboard → **Add New** → **Project** → import the same GitHub repo.

Project settings:

| Field | Value |
|---|---|
| **Framework Preset** | Next.js (auto-detected) |
| **Root directory** | `frontend` |
| **Build command** | (leave default — `npm run build`) |
| **Output directory** | (leave default) |
| **Install command** | (leave default — `npm install`) |

### Step 2: Add environment variables

In **Environment Variables**, add for **Production** (and optionally Preview/Dev):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.onrender.com/api/v1` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://your-backend.onrender.com` |

Note: `NEXT_PUBLIC_*` vars are baked into the client bundle at build time. To change them, you must redeploy.

### Step 3: Deploy and verify

Click **Deploy**. Once live, open the URL. You should see the login page. Try to register:

- ✓ If registration succeeds → both services are wired correctly
- ✗ If you see the **Backend appears offline** banner → backend health probe failed. Open browser DevTools → Network tab → check the `/health` request. Likely CORS — confirm `CLIENT_URL` on Render matches your Vercel URL exactly (no trailing slash).

### Step 4: Update backend CORS allowlist

Once Vercel has assigned a permanent domain, update Render's `CLIENT_URL` env var to that exact URL. The backend re-deploys automatically. Without this, the production frontend's CORS preflight will be denied.

If you use preview deployments, add those URLs too (comma-separated):
```
https://your-app.vercel.app,https://your-app-git-staging.vercel.app
```

---

## 5. Verification checklist

Run through this end-to-end:

- [ ] `https://your-backend.onrender.com/health` → 200 OK
- [ ] `https://your-backend.onrender.com/health/detailed` → `"status": "healthy"`, database connected
- [ ] `https://your-backend.onrender.com/api-docs` → Swagger UI loads
- [ ] Open Vercel URL → login page renders, no console errors
- [ ] Register a new user → succeeds, redirects to `/dashboard`
- [ ] Log out → redirected to `/login`
- [ ] Log back in → succeeds
- [ ] Refresh the dashboard tab after 16 minutes → still authenticated (refresh token rotation works)
- [ ] Hit a protected route with no token (curl `Authorization: Bearer invalid` against `/api/v1/auth/me`) → 401
- [ ] Hit the auth rate limiter (21 wrong logins in 15 min) → 429

---

## 6. Troubleshooting

**"Cannot reach the server" on registration in production**
- Open DevTools Network tab. Look at the `/register` request.
  - **CORS error** → `CLIENT_URL` on Render doesn't match the Vercel URL. Fix and redeploy.
  - **net::ERR_FAILED** with no response → backend is sleeping (Free tier spins down after 15 min). Either wait ~30s for cold start or upgrade to paid.
  - **401** → expected for guest endpoints.
  - **500** → check Render logs.

**Backend logs `MongoDB disconnected — attempting to reconnect`**
- Atlas IP allowlist hasn't permitted Render's egress. Add `0.0.0.0/0` (allow from anywhere) or Render's specific egress IPs.

**Backend crashes on startup with `Invalid environment configuration`**
- `src/config/env.ts` validation failed. Read the printed error — usually a missing or too-short secret. Regenerate per step 3.2 above.

**Frontend builds but shows blank page**
- `NEXT_PUBLIC_API_URL` is wrong or missing. Note: changing env vars in Vercel **requires a redeploy** to take effect — they're baked into the client bundle.

**Render service shows "Healthy" but auth requests fail**
- Trust proxy issue. `app.set('trust proxy', 1)` is already enabled in production (`backend/src/app.ts`). If you customise further, ensure `X-Forwarded-*` headers are honoured for the rate limiter and secure-cookie checks.

---

## 7. Post-deploy hardening (recommendations, not blockers)

- **Add Sentry** for error tracking (free tier covers small projects)
- **Rotate `JWT_SECRET` quarterly** — invalidates all sessions on rotation (forces re-login but worth it)
- **Move uploads to Cloudinary** — `backend/uploads/` is ephemeral on Render (lost on every restart). The hardened Multer config in `product.routes.ts` already filters by MIME and size, but the controller should immediately push to Cloudinary and delete the tmp file.
- **Add a `render.yaml`** for infrastructure-as-code reproducibility
- **Set up Render's auto-deploy on `main`** so pushes trigger redeploys
- **Add a status page** monitor (Render's built-in or external like UptimeRobot)
