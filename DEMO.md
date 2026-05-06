# Klusraak — live demo

## 🌐 Open de demo

**https://aminetaoil-wq.github.io/klusraak/**

[![demo live](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge)](https://aminetaoil-wq.github.io/klusraak/)

## Demo accounts

| Rol     | E-mail                | Wachtwoord  |
|---------|-----------------------|-------------|
| Klant   | `klant@klusraak.nl`   | `Demo1234!` |
| Vakman  | `vakman@klusraak.nl`  | `Demo1234!` |

## Hoe werkt de demo?

- Op `*.github.io` slaat de **localStorage-backed mock-API** automatisch aan (`frontend/public/js/demo/mock-api.js`) — geen URL-parameter nodig.
- Lokaal werkt `?demo=1` als handmatige toggle, en `?demo=0` is de escape hatch om met een echte backend te praten.
- Alle data leeft lokaal in je browser — niets gaat naar een server.
- Reset de demo door in de browser console te draaien: `localStorage.clear()` en herladen.

## Hosting

- Bron: branch `gh-pages` (auto-gepubliceerd vanuit `frontend/public/` door `.github/workflows/deploy-demo-pages.yml` bij elke push naar `main`).
- Provider: GitHub Pages (vereist publieke repo op gratis plan).

## Iets aanpassen?

Edit `frontend/public/...` in deze repo, push naar `main`, demo update binnen ~1 min. Zie de sectie *Aanpassen & uitbreiden* in [`README.md`](./README.md).
