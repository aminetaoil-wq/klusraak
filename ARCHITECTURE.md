# Klusraak — System Architecture

> Production-ready MVP voor een Nederlandse vakman-marktplaats. Klanten plaatsen klussen, vakmannen accepteren, betaling en review afronden.

**Status**: V1 live op [https://aminetaoil-wq.github.io/klusraak/](https://aminetaoil-wq.github.io/klusraak/) (frontend + mock-API). Backend is feature-complete voor MVP, klaar om te deployen op Fly.io + Neon + Upstash.

---

## 1. Architectuur

```
                        ┌──────────────────────────┐
                        │     Frontend SPA          │
                        │  vanilla HTML/CSS/JS      │
                        │  9 schermen, mock-API     │
                        │  voor demo-modus          │
                        └────────────┬─────────────┘
                                     │ HTTPS
                                     │ /api/v1/*
                                     ▼
              ┌──────────────────────────────────────────┐
              │  API gateway laag (Express + middleware) │
              │  • CORS · Helmet · request-id            │
              │  • Redis rate-limit (600 rpm /api)       │
              │  • Bearer JWT auth · role checks         │
              │  • Idempotency keys voor mutations       │
              │  • Zod validatie op alle inputs          │
              └────┬─────────┬───────────┬───────────────┘
                   │         │           │
                   ▼         ▼           ▼
           ┌──────────┐  ┌────────┐  ┌──────────┐
           │ Postgres │  │ Redis  │  │ BullMQ   │
           │ (Prisma) │  │ cache  │  │ workers  │
           │          │  │ + RL   │  │ (4 types)│
           └──────────┘  └────────┘  └────┬─────┘
                                          │
                          ┌───────────────┼──────────────┐
                          ▼               ▼              ▼
                     ┌────────┐     ┌──────────┐   ┌──────────┐
                     │ email  │     │ push     │   │ review-  │
                     │ worker │     │ worker   │   │ aggreg.  │
                     └────────┘     └──────────┘   └──────────┘
```

**Datapad** voor "klant plaatst klus":
1. Browser POST `/api/jobs` met JWT Bearer
2. Rate-limit (Redis) → CORS → request-id → JWT verify → `requireRole(['CLIENT'])` → idempotency check → Zod validate body
3. `jobs.controller` → `jobs.service.createJob(...)` → Prisma `Job.create`
4. Service emits enqueue: `notifications.queue.add('job_posted', {jobId})` → BullMQ workers fan out emails/push naar relevante vakmannen
5. Cache invalidatie: `invalidateOpenJobsFeed()` zodat de nieuwe klus zichtbaar wordt in de open-feed
6. Response 201 met `{job}` shape, ETag header voor latere conditional GETs

---

## 2. Tech stack

| Laag | Keuze | Waarom |
|---|---|---|
| **Frontend** | Vanilla HTML/CSS/JS in `frontend/public/` | Geen build-step; werkt op elke statische host (GitHub Pages, Netlify, S3+CloudFront). V0.5/V1 toont Zoofy-style design. |
| **Backend** | Node 20 + Express 4 + TypeScript (strict) | Mainstream, hireable, snel iteratief. Express omdat de team Express-conventies kent en ecosysteem het rijkst is voor middleware. |
| **ORM** | Prisma | Type-safe, sterke migrations, goede DX. Schema in `backend/prisma/schema.prisma`. |
| **Database** | PostgreSQL 16 | Battle-tested, JSON support voor `Notification.payload`, full-text als V2 nodig. Hosting: Neon (managed). |
| **Cache + RL + Queues** | Redis 7 | Hosting: Upstash (managed, serverless-friendly). Drie rollen: HTTP/data cache, rate-limit counters, BullMQ broker. |
| **Background work** | BullMQ | First-class Redis queues, retries, repeatable jobs, observability. |
| **Auth** | JWT access + refresh rotation | Stateless API; refresh tokens hashed in DB met reuse-detection. |
| **Validatie** | Zod | Eén schema per route → runtime + TS types. |
| **Logging** | Pino | Structured JSON, snel, plaintext-readable in dev. |
| **Metrics** | prom-client | `/metrics` endpoint, scrape met Prometheus/Grafana of Fly's built-in. |
| **Frontend hosting** | GitHub Pages (`gh-pages` branch) | Gratis, simpel, geen vendor lock-in. Auto-deploy via GitHub Action. |
| **Backend hosting** | Fly.io | Edge proxy, Postgres dichtbij, eenvoudig 2 processen (app + worker). |
| **Mail provider** | (V2: Resend / Postmark) | Email worker is voorbereid, provider-config later. |
| **Push** | (V2: Firebase / Apple Push) | Push worker scaffold aanwezig; provider-keys ontbreken. |

---

## 3. File structure

```
klusraak/
├── README.md                     # Project overview + run instructies
├── DEMO.md                       # Live demo URL + accounts
├── ARCHITECTURE.md               # Dit bestand
├── docker-compose.yml            # Lokale full-stack (Postgres + Redis + API + worker)
├── netlify.toml                  # Alternatieve frontend deploy
│
├── docs/
│   └── DEPLOYMENT.md             # Productie runbook (Fly + Neon + Upstash)
│
├── scripts/
│   └── inject-api-base.sh        # Build hook (Netlify/Vercel) voor frontend API base
│
├── .github/
│   └── workflows/
│       └── deploy-demo-pages.yml # Frontend → gh-pages auto-deploy
│
├── .claude/
│   └── agents/                   # Klusraak OS — 6 subagents (orchestrator + specialisten)
│       ├── README.md
│       ├── klusraak-ceo.md
│       ├── klusraak-frontend.md
│       ├── klusraak-backend.md
│       ├── klusraak-deploy.md
│       ├── klusraak-designer.md
│       └── klusraak-qa.md
│
├── frontend/
│   └── public/                   # Statisch deploybaar — geen build step
│       ├── index.html            # 9 screens als <section id="sc-*">
│       ├── css/styles.css        # Design system v2 (warm orange #ff7a00)
│       ├── assets/               # Logo's
│       └── js/
│           ├── config.js         # KLUSRAAK_API_BASE
│           ├── api.js            # Fetch wrapper + ETag + token refresh + idempotency
│           ├── store.js          # In-memory state + localStorage persistence
│           ├── router.js         # Screen visibility + focus management
│           ├── screens.js        # Per-screen render & form bindings
│           ├── utils.js          # Format helpers, toasts, validation, theme toggle
│           ├── app.js            # Global click delegator + boot
│           ├── favicon.js
│           └── demo/
│               ├── mock-store.js # localStorage-backed in-memory DB
│               ├── mock-data.js  # Seed: 36 services, 4 users, 13 jobs, chats, reviews
│               └── mock-api.js   # Fetch-interceptor; auto-activeert op github.io
│
└── backend/
    ├── package.json              # Scripts: dev, build, start, prisma migrate
    ├── tsconfig.json             # strict TS
    ├── Dockerfile                # Multi-stage Alpine, npm-omit-dev in productie
    ├── fly.toml                  # 2 processes: app + worker; release_command = migrate
    ├── .env.example              # Lokale env-template
    ├── .env.production.example   # Prod env-template (zonder secrets)
    │
    ├── prisma/
    │   ├── schema.prisma         # 12 models + 3 enums
    │   ├── seed.ts               # Categorieën seed
    │   └── migrations/           # SQL migrations + lock
    │
    └── src/
        ├── server.ts             # API process entrypoint
        ├── worker.ts             # Worker process entrypoint
        ├── app.ts                # Express factory + middleware wiring
        │
        ├── config/
        │   ├── env.ts            # Zod-validated env (faalt early bij ontbrekende secrets)
        │   ├── logger.ts         # Pino logger
        │   └── prisma.ts         # PrismaClient singleton
        │
        ├── middleware/
        │   ├── auth.ts           # requireAuth + requireRole
        │   ├── error.ts          # AppError → JSON response
        │   ├── idempotency.ts    # Idempotency-Key header support
        │   ├── redisRateLimit.ts # Sliding window rate limit
        │   ├── requestId.ts
        │   ├── requestLogger.ts
        │   └── validate.ts       # Zod request body/query/params
        │
        ├── modules/              # Per-feature: routes + schemas + service + (optional) controller
        │   ├── auth/             # Register, login, refresh, logout, /me
        │   ├── users/            # Profile reads, patch
        │   ├── categories/       # Public list (cached 1h)
        │   ├── jobs/             # CRUD + state transitions
        │   ├── messages/         # Per-job chat (REST polling)
        │   └── reviews/          # Post-completion ratings
        │
        ├── cache/
        │   ├── lru.ts            # In-memory tier
        │   ├── redis.ts          # Redis client singleton
        │   ├── redisCache.ts     # get/set/del helpers
        │   ├── httpCache.ts      # ETag + max-age helpers
        │   └── invalidate.ts     # Centralised invalidations
        │
        ├── observability/
        │   ├── health.ts         # /health (liveness) + /ready (deps check)
        │   └── metrics.ts        # prom-client + /metrics endpoint
        │
        ├── queue/
        │   ├── enqueue.ts        # Type-safe producers
        │   ├── queues.ts         # Queue definitions
        │   ├── jobs.types.ts     # Job payload types
        │   └── workers/
        │       ├── email.worker.ts
        │       ├── notifications.worker.ts
        │       ├── push.worker.ts
        │       └── reviewAggregates.worker.ts
        │
        ├── types/
        │   └── express.d.ts      # Augment Request met `user`
        │
        └── utils/
            ├── AppError.ts       # Standard error shape
            ├── asyncHandler.ts   # Express async wrapper
            ├── jwt.ts            # Sign/verify/rotate
            ├── password.ts       # bcrypt wrapper
            └── params.ts         # Pagination + cursor helpers
```

---

## 4. Database schema

12 modellen, 3 enums. Volledige Prisma schema in `backend/prisma/schema.prisma`.

### Enums
- **`Role`** — `CLIENT` · `CRAFTSMAN` · `ADMIN`
- **`JobStatus`** — `OPEN` → `ASSIGNED` → `IN_PROGRESS` → `COMPLETED` (terminale: `CANCELLED`)
- **`NotificationType`** — `JOB_POSTED` · `JOB_ASSIGNED` · `NEW_MESSAGE` · `NEW_REVIEW` · `JOB_COMPLETED`

### Modellen

| Model | Velden (kern) | Relaties |
|---|---|---|
| **User** | `id`, `email` (uniek), `passwordHash`, `name`, `phone?`, `avatarUrl?`, `role`, `createdAt`, `updatedAt` | 1:1 `CraftsmanProfile?`, 1:N `Job` (als client), 1:N `JobAssignment` (als craftsman), 1:N `Message` (sender), 1:N `Review` (zowel `from` als `to`), 1:N `RefreshToken`, 1:N `Notification` |
| **CraftsmanProfile** | `userId` (1:1), `kvkNumber`, `hourlyRateCents`, `bio?`, `city?`, `verifiedAt?`, `avgRating?`, `reviewCount` | M:N `Category` via `CategoryOnCraftsman` |
| **Category** | `id`, `slug` (uniek), `name`, `iconKey?`, `groupName?` | M:N `CraftsmanProfile` |
| **CategoryOnCraftsman** | `craftsmanId`, `categoryId` (composite PK) | join |
| **Job** | `id`, `clientId`, `categoryId`, `title`, `description`, `city`, `postcode?`, `budgetCents?`, `scheduledAt?`, `status` (default `OPEN`), `createdAt`, `updatedAt` | N:1 `User` (client), N:1 `Category`, 1:1 `JobAssignment?`, 1:N `Message`, 1:N `Review` |
| **JobAssignment** | `id`, `jobId` (1:1), `craftsmanId`, `acceptedAt`, `startedAt?`, `completedAt?` | N:1 `User` (craftsman) |
| **Message** | `id`, `jobId`, `senderId`, `content`, `readAt?`, `createdAt` | N:1 `Job`, N:1 `User` |
| **Review** | `id`, `jobId`, `fromId`, `toId`, `rating` (1-5), `comment?`, `createdAt` | unique `(jobId, fromId)` |
| **Notification** | `id`, `userId`, `type` (enum), `payload` (Json), `readAt?`, `createdAt` | N:1 `User` |
| **RefreshToken** | `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt?`, `replacedById?`, `createdAt` | rotation chain |

### Belangrijke invariants
- `JobAssignment` is 1:1 met `Job` — een klus heeft maximaal één toegewezen vakman.
- `Review` is uniek per `(jobId, fromId)` — elke partij beoordeelt max één keer.
- `RefreshToken.replacedById` koppelt rotation; reuse-detection wist alle tokens van die `userId`.
- Bedragen altijd in cents (integer), nooit floats.

### Migrations
- Initial migration: `backend/prisma/migrations/20260427100254_init/migration.sql`
- Nieuwe migrations: `cd backend && npx prisma migrate dev --name <descriptive>`
- Productie: `prisma migrate deploy` als `release_command` in `fly.toml`.

---

## 5. API endpoints

Alle `/api/*` routes vereisen `Authorization: Bearer <jwt>` tenzij anders vermeld. Standard error-shape: `{ code, message, requestId, details? }`.

### Auth (`backend/src/modules/auth/`)
| Method | Path | Auth | Body / Returns |
|---|---|---|---|
| POST | `/api/auth/register` | public | `{email, password, name, role, phone?}` → `{accessToken, refreshToken, user}` |
| POST | `/api/auth/login` | public | `{email, password}` → tokens + user |
| POST | `/api/auth/refresh` | public | `{refreshToken}` → nieuwe tokens (rotation) |
| POST | `/api/auth/logout` | public | `{refreshToken}` → 204 (revokes chain) |
| GET  | `/api/auth/me` | bearer | huidige user + craftsmanProfile? |

### Users
| Method | Path | Auth | Doel |
|---|---|---|---|
| GET | `/api/users/me` | bearer | profile met craftsmanProfile + recent reviews |
| GET | `/api/users/:id` | bearer | publiek profiel + ratings |
| GET | `/api/users/:id/reviews` | bearer | review history (cursor-paginated) |
| PATCH | `/api/users/me` | bearer | update name/phone/avatar |
| PATCH | `/api/users/me/craftsman` | bearer (CRAFTSMAN) | KvK/bio/categorieën |

### Categories
| Method | Path | Auth | Doel |
|---|---|---|---|
| GET | `/api/categories` | public | volledige catalogus, gecached 1h |

### Jobs
| Method | Path | Auth | Doel |
|---|---|---|---|
| POST | `/api/jobs` | bearer (CLIENT) | klus plaatsen — idempotent |
| GET | `/api/jobs` | bearer | role-aware: klant ziet eigen klussen, vakman ziet open feed |
| GET | `/api/jobs/:id` | bearer | detail (alleen klant of toegewezen vakman) |
| GET | `/api/jobs/open` | bearer (CRAFTSMAN) | open feed met filters `?categoryId=&city=&cursor=` |
| PATCH | `/api/jobs/:id` | bearer (CLIENT) | titel/desc/budget aanpassen pre-assignment |
| POST | `/api/jobs/:id/accept` | bearer (CRAFTSMAN) | atomisch: status `OPEN` → `ASSIGNED` + assignment record |
| POST | `/api/jobs/:id/start` | bearer (CRAFTSMAN) | `ASSIGNED` → `IN_PROGRESS` |
| POST | `/api/jobs/:id/complete` | bearer (CRAFTSMAN) | `IN_PROGRESS` → `COMPLETED` |
| POST | `/api/jobs/:id/cancel` | bearer (CLIENT, pre-assignment) | → `CANCELLED` |

### Messages
| Method | Path | Auth | Doel |
|---|---|---|---|
| GET | `/api/jobs/:id/messages` | bearer (party) | thread, cursor-paginated |
| POST | `/api/jobs/:id/messages` | bearer (party, post-assignment) | nieuw bericht; triggert notif worker |

### Reviews
| Method | Path | Auth | Doel |
|---|---|---|---|
| POST | `/api/jobs/:id/reviews` | bearer (party, post-COMPLETED) | rating 1-5 + comment; triggert review-aggregates worker |

### Health & metrics
| Method | Path | Auth | Doel |
|---|---|---|---|
| GET | `/health` | public | liveness — proces draait? |
| GET | `/ready` | public | readiness — Postgres + Redis bereikbaar? |
| GET | `/metrics` | public (intern netwerk) | Prometheus exposition |

### Auth scopes
- **`requireAuth`** verifieert Bearer JWT, hangt `req.user = {id, role, email}` aan request.
- **`requireRole(['CLIENT'])`** etc. weigert met `403 forbidden` bij role-mismatch.
- Job-level toegangscontrole gebeurt in de service-laag (klant of toegewezen vakman bij messages/details).

### Idempotency
Mutaties (POST jobs, POST messages, POST reviews) accepteren `Idempotency-Key: <uuid>` header. De middleware (`backend/src/middleware/idempotency.ts`) cached de response 24h zodat retry's niet dubbele records aanmaken.

### Rate limiting
Sliding window via Redis: **600 requests/min per IP** voor `/api/*`. Auth-routes hebben een strenger sublimiet (60/min) — TODO toevoegen.

---

## 6. UI architectuur

### Schermen (9, allemaal in `frontend/public/index.html`)

```
sc-home          ──► public landing (Zoofy-style, single CTA hero)
sc-services     ──► alle 36 diensten in 10 groepen, live search
sc-auth         ──► tabs: login | register (rolkeuze: klant vs vakman)
sc-dash         ──► role-aware dashboard (KPI tiles, snelle acties)
sc-jobs         ──► klant: mijn klussen | vakman: open klussen feed met filter chips
sc-new          ──► 3-staps stepper: categorie → details → locatie
sc-job          ──► detail + acties (accept/start/complete/cancel/chat/review)
sc-chat         ──► per-klus thread, polling-based delivery
sc-profile      ──► user info + craftsman info (KvK, bio, categories)
```

### Routing pattern

`Router.go(screenId)` schakelt sectie-zichtbaarheid via CSS class `.on`. Geen URL-routing nu (V0.5/V1 kiest tegen browser back/forward complexiteit) — V2 brengt history.pushState terug zodra deeplinks nodig zijn.

`screen:enter` custom event triggert per-scherm data-fetch in `screens.js`.

### State

`window.Store` singleton (`store.js`):
- `accessToken`, `refreshToken` — uit localStorage gehydreerd op boot
- `user` — `{id, role, email, name}`
- `categories` — pre-fetched op boot voor instant dropdowns
- Mutators emitteren `store:change` events voor UI re-render

### Design system

Tokens in `:root` (`css/styles.css`):
- Surfaces: `#07080c` → `#0c0e14` → `#11141c` → `#161a24`
- Foreground: `#ffffff` → `#7d8194`
- Brand: `#ff7a00` (primary), `#ff9a3d` (hover), `#ffb070` (subtle)
- Glass tokens (semi-transparent overlays voor floating UI)
- Spacing: 4-48px ladder
- Type: Geist of Inter, 11px-48px scale, `clamp()` voor responsief

Componenten: `.btn` (primary/outline/ghost/secondary), `.badge`, `.card`, `.path-card`, `.stat-box`, `.stepper`, `.chips`, `.faq` (`<details>`).

### Demo modus (kritieke MVP-feature)

Bij ontbreken van een live backend (e.g. github.io publication):
- `frontend/public/js/demo/mock-api.js` patcht `window.fetch`
- Auto-activeert op niet-localhost hostnames
- `mock-store.js` is een localStorage-backed in-memory DB die de Prisma-schema mirrort
- `mock-data.js` seedt 4 users, 13 jobs over alle statussen, chats, reviews
- Reset: `localStorage.clear()` + reload

Dit pad ondersteunt **alle** UI-flows zonder backend.

---

## 7. Auth & security

- **Password storage**: bcrypt met `BCRYPT_ROUNDS=12` (default; configureerbaar via env)
- **JWT secrets**: minimum 16 chars, gevalideerd in env-schema
- **Token TTL**: access 15min, refresh 30 dagen, rotation op elke refresh
- **Reuse detection**: revoked refresh-token gebruikt? → wis alle tokens van die userId
- **Helmet**: default secure headers (CSP placeholder, HSTS, X-Frame-Options DENY)
- **CORS**: env-configurable origin (`CORS_ORIGIN`), default `*` voor dev
- **No PII in logs**: request logger redacteert `password`, `token`, `email`
- **Idempotency**: voorkomt dubbele transacties bij retries
- **Rate limiting**: gemerged in Postgres-laag — auth-routes worden in V1.1 strenger gelimiteerd

### Security TODOs voor productie
- [ ] CSP header tighten (alleen self + cdn voor fonts)
- [ ] CORS allowlist (geen `*` in productie)
- [ ] Strengere rate-limit op `/api/auth/login` (5/min/IP)
- [ ] CAPTCHA op `/api/auth/register` (V1.1)
- [ ] OAuth providers (Google, Microsoft) als V2 — auth.service.ts is voorbereid

---

## 8. Background jobs

BullMQ queues in `backend/src/queue/queues.ts`. Workers draaien in apart proces (`worker.ts`) zodat scheme: API-pods en worker-pods onafhankelijk schalen.

| Queue | Worker | Triggert | Doel |
|---|---|---|---|
| `email` | `email.worker.ts` | register, password-reset, klus accepted | Provider call (placeholder; integratie V1.1) |
| `notifications` | `notifications.worker.ts` | job posted, job assigned, message, review | Maakt `Notification` records + fan-out |
| `push` | `push.worker.ts` | nieuwe message, status update | Provider call (placeholder) |
| `reviewAggregates` | `reviewAggregates.worker.ts` | review created | Update `CraftsmanProfile.avgRating` + `reviewCount` |

Conventies:
- Idempotency: elke job heeft een unique `jobId` afgeleid van payload
- Retries: exponential backoff, max 5
- Cleanup: completed jobs auto-removed na 100, failed na 1000

---

## 9. Caching strategy

Drie tiers, aflopend in lifetime:

1. **In-memory LRU** (`backend/src/cache/lru.ts`) — single-pod cache voor zeer hot keys (categorieën). 60s TTL.
2. **Redis cache** (`backend/src/cache/redisCache.ts`) — gedeelde cache over alle pods. TTL configureerbaar per resource type:
   - Categorieën: 1h (`CACHE_TTL_CATEGORIES`)
   - Open jobs feed: 30s (`CACHE_TTL_FEED`)
   - Job detail: 60s (`CACHE_TTL_JOB`)
   - User profile: 2min (`CACHE_TTL_USER`)
3. **HTTP cache** (`backend/src/cache/httpCache.ts`) — ETag + `max-age` headers op GET responses. Frontend `api.js` hergebruikt ETags via `If-None-Match`.

Invalidatie: `backend/src/cache/invalidate.ts` exporteert helpers (`invalidateUserCache(id)`, `invalidateOpenJobsFeed()`) die zowel LRU als Redis tier wissen. Diens worden opgeroepen vanuit service-mutaties.

---

## 10. Observability

- **Logs**: Pino structured JSON. Velden: `level`, `time`, `requestId`, `userId?`, `route?`, `latencyMs?`, `msg`. In dev pretty-printed.
- **Metrics** (`/metrics`): Prometheus exposition.
  - HTTP: `http_requests_total{method,route,status}`, `http_request_duration_seconds_bucket`
  - DB: query counters per Prisma operation
  - Queue: `bullmq_jobs_active`, `bullmq_jobs_completed_total`, `bullmq_jobs_failed_total`
  - Cache: `cache_hits_total{tier}`, `cache_misses_total{tier}`
  - Rate-limit: `ratelimit_blocks_total`
- **Health**: 
  - `/health` — proces alive (200 als event-loop niet stuck)
  - `/ready` — checkt Postgres + Redis (200 alleen als beide reachable)
- **Request-id**: per-request UUID via `requestId.ts`, lekt mee in alle logs en error-responses
- **Errors**: `AppError` → `error.ts` middleware → consistente `{code, message, requestId}` JSON

---

## 11. Deploy architectuur

### Frontend
```
git push → main
   └── .github/workflows/deploy-demo-pages.yml
        └── peaceiris/actions-gh-pages@v3
             └── publishes frontend/public/ → gh-pages branch (orphan)
                  └── GitHub Pages serves https://aminetaoil-wq.github.io/klusraak/
```

Cache busting via `?v=<n>` query param op CSS/JS includes + `no-cache` meta tags. Manual cache-bust per release: bump `v` in `index.html`.

Alternatieve hosts: Netlify (`netlify.toml` aanwezig — connect repo, Build command leeg, Publish dir `frontend/public/`), of Vercel met `outputDirectory: frontend/public`.

### Backend
```
git push → main
   └── (todo: backend CI workflow)
        └── flyctl deploy from backend/
             ├── Dockerfile multi-stage build
             ├── release_command runs `prisma migrate deploy`
             ├── 2 processes per machine: app + worker
             └── min 1 machine, scales to N via fly autoscale
```

Postgres → **Neon** (managed, branched per PR mogelijk).
Redis → **Upstash** (serverless, pay-per-request, BullMQ-compatible).

Env secrets via `flyctl secrets set`. Zie `docs/DEPLOYMENT.md` voor stap-voor-stap.

### Lokale full-stack
```
docker compose up -d   # Postgres 16 + Redis 7
cd backend
npm install
npx prisma migrate dev
npm run dev            # API op :4000
npm run worker         # in tweede shell
cd frontend/public
python3 -m http.server 5173
```

---

## 12. Scaling

### Wat is al stateless
- API pods: geen sessie-state in proces. JWT bevat alle context. Horizontal scale via Fly machines.
- Worker pods: BullMQ verdeelt jobs over alle workers; geen master-election nodig.
- Frontend: pure CDN, schaalt sublinear in cost.

### Eerste bottleneck (verwacht bij ~100 req/s)
**Postgres connection pool**. Prisma default is 10. Bij 5 pods × 10 = 50 connecties — Neon Free heeft 100. Mitigatie:
- Connection pooling via PgBouncer (Neon biedt het op de connection string)
- `?connection_limit=10&pool_timeout=20` op DATABASE_URL

### Volgende bottleneck (~1000 req/s)
**Redis voor rate-limit + cache**. Single-instance Redis is goed voor ~50K ops/s. Mitigatie:
- Upstash Pro voor multi-region
- Splits cache vs queues over twee Redis instances

### Sleutel-pad-optimalisaties (verwachte hot paths)
- `GET /api/jobs/open` — gecached 30s, ETag voor 304's. Bij 10x traffic: pre-render per `(category, city)` paar in een worker → write naar Redis.
- `GET /api/categories` — gecached 1h, immutable in praktijk. Push naar CDN-edge zou cachen op vies-niveau.
- `POST /api/messages` — schrijft 1 row + queue 1 notification. OK voor 10K msg/min met huidige setup.

### Storage groei
- Postgres 16 op Neon: 0.5 GB free, 10 GB Pro. Dominant: `Message` (chat history). Bij 100K messages × 200 bytes = 20 MB. Headroom is groot.
- Geen file storage in MVP. Avatar URLs verwijzen naar externe (CDN/S3 in V2).

### Wat komt apart als V2 nodig
- **Search** (full-text op klus-title/description) → Postgres `tsvector` met GIN index, of Meilisearch sidecar.
- **Geo matching** (vakman dichtbij) → PostGIS extensie + `geography` columns op `Job.location` en `CraftsmanProfile.serviceArea`.
- **Realtime chat** → Socket.io op een aparte WS-pod, Redis adapter voor multi-pod.

---

## 13. Production-readiness audit

### ✅ Klaar
- Stateless API + worker, horizontaal schaalbaar
- Strict TypeScript backend, Zod-validated env + inputs
- Multi-stage Dockerfile, multi-process Fly.toml
- Prisma migrations met `release_command` voor zero-downtime schema changes
- Refresh token rotation met reuse-detection
- Rate limiting + idempotency + request-id + structured logs + Prometheus metrics
- Health + readiness probes
- Backend env validation faalt early bij ontbrekende secrets
- Mock-API tier voor frontend-only demo (cruciaal voor sales/recruitment showcase)

### ⚠️ Gaps voor V1.1 (kort termijn)
- [ ] **Backend CI**: geen GitHub Action voor backend lint/build/migrate-check. Komt mee in deze PR.
- [ ] **Tests**: geen test files. MVP-acceptabel, maar smoke + integratie tests nodig voordat we klanten onboarden.
- [ ] **Email/push providers**: workers zijn placeholders; integreer Resend (transactional email) en Firebase (push) in V1.1.
- [ ] **CORS allowlist**: huidige default `*` is dev-OK, productie moet origin-lijst krijgen.
- [ ] **Strengere rate limits op auth-routes**: 60/min op `/api/auth/*` is nog te ruim voor login bruteforce.
- [ ] **Secrets rotation**: JWT secrets handmatig roteren via `flyctl secrets set`. Documenteer cadans (kwartaal).
- [ ] **Monitoring/alerting**: Prometheus exposition is er, maar geen Grafana dashboard of PagerDuty hook.

### 🚧 V2 (post-MVP)
- Stripe payments (escrow flow, dispute handling)
- Realtime chat (Socket.io / Supabase Realtime)
- Admin panel (gebruikers, klussen, disputes)
- Geo-distance matching (PostGIS)
- Full-text search (Postgres tsvector)
- Native mobile apps (React Native of Capacitor wrapper rond de SPA)

### V3 strategisch
- Migratie van vanilla SPA naar Next.js voor SSR + betere SEO (alleen als organic search een groei-driver wordt).
- ML-matching: voorspel kans dat een vakman een klus accepteert, sorteer feed daarop.

---

## 14. Hoe begin je vandaag

```bash
# Clone
git clone https://github.com/aminetaoil-wq/klusraak.git
cd klusraak

# Frontend lokaal (demo-mode, geen backend)
cd frontend/public
python3 -m http.server 5173
# → http://localhost:5173/?demo=1

# Of: full-stack lokaal
docker compose up -d
cd backend
npm install
cp .env.example .env       # vul JWT secrets in
npx prisma migrate dev
npm run dev                # API :4000
npm run worker             # 2e shell

# Demo accounts (in mock-data + seed):
# klant@klusraak.nl   / Demo1234!
# vakman@klusraak.nl  / Demo1234!
```

Voor productie deploy: zie [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

Voor agentic ontwikkeling: zie [`.claude/agents/README.md`](./.claude/agents/README.md) — `klusraak-ceo` is je entry point.
