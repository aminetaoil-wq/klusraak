# Klusraak

> De snelste weg naar de juiste vakman. Marktplaats voor Nederlandse klussen — klanten plaatsen werk, vakmannen accepteren binnen 30 minuten.

## 🌐 Live demo

**👉 [https://aminetaoil-wq.github.io/klusraak/](https://aminetaoil-wq.github.io/klusraak/)**

[![demo live](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge)](https://aminetaoil-wq.github.io/klusraak/) [![GitHub Pages](https://img.shields.io/badge/hosted_on-GitHub_Pages-181717?style=for-the-badge&logo=github)](https://aminetaoil-wq.github.io/klusraak/)

> Op `github.io` slaat de demo-modus automatisch aan (mock-API in localStorage, geen backend nodig). Lokaal werkt `?demo=1` als handmatige toggle, en `?demo=0` is de escape hatch om de echte backend te gebruiken. Zie ook [`DEMO.md`](./DEMO.md).

📐 **Voor het hele system design** (architectuur, schema, endpoints, scaling, production-readiness audit) → zie [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Stack

- **Frontend** — vanilla HTML/CSS/JS SPA in `frontend/public/` (geen build-step nodig). Geest typografie, Lucide icons, dark + light theme, glassmorphism, warm oranje accent (#ff7a00) — Klusraak Design System v2.
- **Backend** — Node 20 + Express + TypeScript + Prisma + PostgreSQL + Redis (BullMQ workers) in `backend/`.
- **Demo-modus** — auto-actief op `*.github.io`; lokaal te forceren met `?demo=1` of uit te zetten met `?demo=0`. Activeert een localStorage-backed mock-API zodat de frontend zonder backend werkt.

## Schermen

Home (single-CTA hero, "Hoe het werkt"-stack) · Alle diensten (40 services in 10 groepen, met live search) · Inloggen/registreren · Dashboard · Mijn klussen / Open klussen · Nieuwe klus (3-staps stepper) · Klus-detail · Chat · Profiel.

## Demo accounts

| Rol     | E-mail                | Wachtwoord  |
|---------|-----------------------|-------------|
| Klant   | `klant@klusraak.nl`   | `Demo1234!` |
| Vakman  | `vakman@klusraak.nl`  | `Demo1234!` |

---

## Lokaal draaien (frontend-only, demo-modus)

```bash
cd frontend/public
python3 -m http.server 5173
# Open http://localhost:5173/?demo=1   (lokaal moet je 'm aanzetten)
```

## Lokaal draaien (full-stack)

Vereist Docker.

```bash
docker compose up -d            # Postgres + Redis + API + worker
cd frontend/public
python3 -m http.server 5173
# Open http://localhost:5173 (zonder ?demo=1)
```

## Deploy demo naar GitHub Pages

1. **Repo instelling** — Settings → Pages → Source: *Deploy from a branch* → `gh-pages` / `(root)`
2. **Push naar `main`** — `.github/workflows/deploy-demo-pages.yml` publiceert dan `frontend/public/` naar `gh-pages`
3. **Site beschikbaar op** `https://<owner>.github.io/<repo>/` (demo-modus slaat automatisch aan)

## Aanpassen & uitbreiden

De demo wordt direct uit deze repo gepubliceerd, dus elke wijziging in `frontend/public/` belandt na een push naar `main` automatisch op de live demo (workflow run duurt ~30s).

**Workflow voor wijzigingen:**

1. Maak een branch aan (of vraag het deze agent: *"pas X aan"*).
2. Edit de relevante bestanden:
   - **UI / schermen** → `frontend/public/js/screens.js`
   - **Routing** → `frontend/public/js/router.js`
   - **State / store** → `frontend/public/js/store.js`
   - **Styling** → `frontend/public/css/styles.css`
   - **Mock-data voor demo** → `frontend/public/js/demo/mock-data.js`
   - **Mock-API responses** → `frontend/public/js/demo/mock-api.js`
   - **Markup root** → `frontend/public/index.html`
3. Test lokaal: `cd frontend/public && python3 -m http.server 5173` → `http://localhost:5173/?demo=1` (lokaal handmatig aanzetten).
4. Open een PR → merge naar `main` → demo update zelf binnen ~1 min.

**Backend uitbreiden** → `backend/src/modules/<feature>/` (routes, schemas, service per feature). Daarna `npx prisma migrate dev` als schema verandert. Zie `docs/DEPLOYMENT.md` voor productie-deploy naar Fly.io.

## Backend deploy

Zie `docs/DEPLOYMENT.md` voor Fly.io + Neon (Postgres) + Upstash (Redis).

---

## Project structuur

```
.
├── frontend/public/          vanilla SPA — index.html, css/, js/, js/demo/, assets/
├── backend/                  Node + Express + Prisma API + BullMQ workers
├── docs/DEPLOYMENT.md        infra runbook
├── docker-compose.yml        lokale full-stack
├── netlify.toml              alternatieve frontend deploy
└── .github/workflows/        gh-pages deploy
```

## Toegankelijkheid

WCAG 2.1 AA pass: skip-link, semantic landmarks, focus management op screen-change, `aria-live` voor toasts, `:focus-visible` rings, `prefers-reduced-motion` ondersteund, contrast-correct (`--sub` >5:1 op alle achtergronden), keyboard-navigatie door lijsten en chips.

## Licentie

(Voeg toe naar wens — repo is voor demo-doeleinden.)
