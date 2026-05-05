# KlusRaak — Web client

Static HTML/CSS/JS. No build step. Mobile-first, designed to be served from
any static host (Cloudflare Pages, Netlify, S3+CloudFront, GitHub Pages).

## Run locally

The API must be running first (see `backend/`). Then serve `public/`:

```bash
cd public
python3 -m http.server 5173
# or:
npx --yes http-server -p 5173 .
```

Open http://localhost:5173.

## Configuring the API base URL

By default the client points to `http://localhost:4000`. To override, set
`window.KLUSRAAK_API_BASE` before `js/api.js` loads — e.g. inject a tiny
inline script at the top of `index.html` for production builds:

```html
<script>window.KLUSRAAK_API_BASE = "https://api.klusraak.nl";</script>
```

## Files

| File              | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `index.html`      | All screens in one document.                           |
| `css/styles.css`  | Brand styling (dark + orange).                         |
| `js/api.js`       | Fetch wrapper with token refresh.                      |
| `js/store.js`     | Local state + persisted session.                       |
| `js/router.js`    | Screen show/hide.                                      |
| `js/screens.js`   | Per-screen render + form handlers.                     |
| `js/app.js`       | Bootstrap (initial route, global event delegation).    |
