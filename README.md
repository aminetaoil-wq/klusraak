# Klusraak

> De snelste weg naar de juiste vakman. Marktplaats voor Nederlandse klussen — klanten plaatsen werk, vakmannen accepteren binnen 30 minuten.

**Live demo:** https://aminetaoil-wq.github.io/klusraak/?demo=1 *(actief zodra GitHub Pages aan staat — zie deploy-sectie)*

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
