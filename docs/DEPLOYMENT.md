# Deploying KlusRaak

This guide deploys the stack across three managed providers:

| Tier | Provider | Why |
|------|----------|-----|
| Frontend | Netlify | Static hosting + branch previews + free TLS. |
| API + worker | Fly.io | Long-running Node processes via Docker, two processes per app. |
| Postgres | Neon | Managed Postgres with branch databases and built-in pgbouncer. |
| Redis | Upstash | Managed Redis (`rediss://`) with a usable free tier. |

You can swap any provider for an equivalent (Render, Supabase, Elasticache,
Cloudflare Pages) without code changes.

---

## 1. Prepare the repo (one-time)

```bash
# 1.1 Generate the initial Prisma migration. Needs any local Postgres —
#     docker compose works:
docker compose up -d db
cd backend
DATABASE_URL=postgresql://klusraak:klusraak@localhost:5432/klusraak?schema=public \
  npx prisma migrate dev --name init
git add prisma/migrations
git commit -m "chore: initial prisma migration"
```

The committed `backend/prisma/migrations/<timestamp>_init/` folder is what
Fly's `release_command` applies on every deploy.

```bash
# 1.2 Generate the JWT secrets you will paste into Fly secrets later.
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
```

---

## 2. Provision Postgres (Neon)

1. Create a project at https://console.neon.tech.
2. Copy two connection strings from the dashboard:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`. Append
     `&pgbouncer=true&connection_limit=10`.
   - **Direct** (no `-pooler`) → `DATABASE_DIRECT_URL`. Used only by
     migrations.

Neon's free tier is enough for the MVP. Pick the EU region closest to
your Fly app (default `ams` → `eu-central-1`).

---

## 3. Provision Redis (Upstash)

1. Create a database at https://console.upstash.com.
2. Choose the same region as Fly (e.g. `eu-west-1`).
3. Copy the `rediss://` URL from "Connect → ioredis" → `REDIS_URL`.

---

## 4. Deploy the API + worker (Fly)

```bash
# 4.1 Install flyctl: https://fly.io/docs/flyctl/install/
fly auth login

# 4.2 Launch the app from backend/ — uses the existing fly.toml.
cd backend
fly launch --no-deploy --copy-config

# 4.3 Set every secret. Use the values from steps 1 + 2 + 3.
fly secrets set \
  JWT_ACCESS_SECRET=...            \
  JWT_REFRESH_SECRET=...            \
  DATABASE_URL=...                  \
  DATABASE_DIRECT_URL=...           \
  REDIS_URL=...                     \
  CORS_ORIGIN=https://placeholder.netlify.app

# 4.4 Deploy. release_command runs `prisma migrate deploy` first; both
#     `app` and `worker` processes start after it exits 0.
fly deploy
```

Verify:

```bash
curl -s  https://klusraak-api.fly.dev/health   # {"status":"ok"}
curl -s  https://klusraak-api.fly.dev/ready    # {"ok":true,"db":true,"redis":true}
fly logs -p worker | head                      # worker startup line
```

---

## 5. Deploy the frontend (Netlify)

1. Push the repo to GitHub if you haven't already.
2. New site → "Import from Git" → select the repo.
3. Netlify auto-detects `netlify.toml` (publish dir + build command).
4. **Site env vars → Add variable:**
   - `KLUSRAAK_API_BASE` = `https://klusraak-api.fly.dev`
5. Trigger a deploy.

Verify:

```bash
curl -sI https://klusraak.netlify.app/ | grep -i cache-control
curl -s  https://klusraak.netlify.app/js/config.js   # contains the API base
```

---

## 6. Wire CORS

Now that the Netlify URL is final, point the API at it:

```bash
fly secrets set CORS_ORIGIN=https://klusraak.netlify.app
fly deploy   # restart picks up the new origin
```

End-to-end smoke test:

```bash
# CORS preflight from the Netlify origin
curl -sI -X OPTIONS https://klusraak-api.fly.dev/api/categories \
  -H 'Origin: https://klusraak.netlify.app' \
  -H 'Access-Control-Request-Method: GET' | grep -i access-control
# Then open the Netlify URL and run the demo flow:
#   register a client → post a klus → log in as the seeded craftsman → accept → chat → review.
```

---

## 7. Operate

- **Logs.** `fly logs -a klusraak-api`. Filter by process: `fly logs -p worker -a klusraak-api`.
- **Metrics.** `https://klusraak-api.fly.dev/metrics` (Prometheus exposition). Scrape from Grafana Cloud or Fly's built-in Prometheus.
- **Migrations.** Add a Prisma migration locally, commit, push. The next `fly deploy` runs `prisma migrate deploy` via `release_command`.
- **Secrets rotation.** `fly secrets set NEW_SECRET=...` triggers a rolling restart automatically.
- **Scaling.** `fly scale count app=2` doubles API replicas; the worker scales separately with `fly scale count worker=2`. Caches and rate-limit counters are already cluster-wide via Redis.

---

## Common pitfalls

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `PrismaClientInitializationError` on first request | Missing alpine binary target | Already set in `schema.prisma`; rebuild the image. |
| `release_command` fails with "advisory lock" or "prepared statement" errors | Migrations going through pgbouncer | Confirm `DATABASE_DIRECT_URL` is set and points to the non-pooled URL. |
| `/ready` 503 with `redis: false` | `REDIS_URL` uses `redis://` not `rediss://` | Upstash requires TLS; switch the scheme. |
| CORS error in browser console | `CORS_ORIGIN` doesn't match the Netlify URL exactly | Update `fly secrets set CORS_ORIGIN=...` and redeploy. |
| Frontend hits `localhost:4000` | `KLUSRAAK_API_BASE` not set on Netlify, or build wasn't triggered after setting it | Re-deploy from Netlify after setting the env var. |
| Worker not picking up jobs | Worker process didn't start; check `fly status` | `fly scale count worker=1`. |
