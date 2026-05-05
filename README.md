# Klusraak

> De snelste weg naar de juiste vakman. Marktplaats voor Nederlandse klussen — klanten plaatsen werk, vakmannen accepteren binnen 30 minuten.

### 🚀 [Open de live demo →](https://aminetaoil-wq.github.io/klusraak/?demo=1)

[![Open demo](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge)](https://aminetaoil-wq.github.io/klusraak/?demo=1)

> Activeren in één keer: merge PR naar `main` → **Settings → Pages → Source: `gh-pages` / `(root)`**. Daarna publiceert elke push naar `main` automatisch naar de demo (zie [Aanpassen & uitbreiden](#aanpassen--uitbreiden)).

---

## Stack

- **Frontend** — vanilla HTML/CSS/JS SPA in `frontend/public/` (geen build-step nodig). Geest typografie, Lucide icons, dark + light theme, glassmorphism, indigo/violet/cyan accenten — volgt het Klusraak Design System.
- **Backend** — Node 20 + Express + TypeScript + Prisma + PostgreSQL + Redis (BullMQ workers) in `backend/`.
- **Demo-modus** — `?demo=1` activeert een localStorage-backed mock-API zodat de frontend zonder backend werkt.

## Schermen

Home (dual-path entry: klant vs vakman) · Alle diensten (40 services in 10 groepen, met live search) · Inloggen/registreren · Dashboard · Mijn klussen / Open klussen · Nieuwe klus (3-staps stepper) · Klus-detail · Chat · Profiel.

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
# Open http://localhost:5173/?demo=1
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
3. **Site beschikbaar op** `https://<owner>.github.io/<repo>/?demo=1`

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
3. Test lokaal: `cd frontend/public && python3 -m http.server 5173` → `http://localhost:5173/?demo=1`.
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
