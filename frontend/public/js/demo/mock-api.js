// Static-demo mock backend. Activates when the URL has ?demo=1, a previous
// visit set the sticky flag, or the page is hosted somewhere without a
// reachable backend (e.g. *.github.io). Patches window.fetch so every
// /api/* call resolves locally; non-/api requests pass through.
(function () {
  const FLAG_KEY = 'klusraak.demo';
  const params = new URLSearchParams(location.search);
  const fromUrl = params.has('demo') && params.get('demo') !== '0';
  const fromStorage = localStorage.getItem(FLAG_KEY) === '1';
  const isLocalDev = ['localhost', '127.0.0.1', '0.0.0.0', ''].includes(location.hostname);
  const fromHost = !isLocalDev && !window.KLUSRAAK_HAS_BACKEND;
  if (params.get('demo') === '0') {
    localStorage.removeItem(FLAG_KEY);
    return;
  }
  if (!fromUrl && !fromStorage && !fromHost) return;
  if (fromUrl) localStorage.setItem(FLAG_KEY, '1');

  // Force the real api.js to build relative /api/* URLs so our fetch
  // hook sees the path directly instead of an absolute http://localhost:4000.
  window.KLUSRAAK_API_BASE = '';

  const KR = (window.KR = window.KR || {});

  // Boot a tiny "DEMO" badge once the body exists.
  function markBody() {
    if (document.body) document.body.classList.add('demo-mode');
    else document.addEventListener('DOMContentLoaded', () => document.body.classList.add('demo-mode'));
  }
  markBody();

  // Seed runs as soon as the store script is loaded (it's loaded before
  // this file in index.html, see the load order).
  KR.MockSeed?.seedIfEmpty();

  // ---------- Token plumbing ----------

  // Access tokens: opaque string `mock.<userId>.<rand>`. We trust the
  // token's payload because this is a single-browser demo. The matching
  // user record is the source of truth.
  const ACTIVE_TOKENS = new Set();
  const issueAccessToken = (userId) => {
    const t = `mock.${userId}.${Math.random().toString(36).slice(2, 10)}`;
    ACTIVE_TOKENS.add(t);
    return t;
  };
  const userIdFromToken = (token) => {
    if (!token || !token.startsWith('mock.')) return null;
    const parts = token.split('.');
    if (parts.length < 3) return null;
    return parts[1];
  };
  const userFromAuthHeader = (headers) => {
    const auth = headers.get('Authorization') || headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const id = userIdFromToken(token);
    if (!id) return null;
    return KR.MockStore.findUserById(id);
  };

  // Idempotency replay cache for createJob / acceptJob. Keyed by
  // (userId, key); persists in memory only — that's enough for the
  // common "double-tap submit" case.
  const idempotency = new Map();
  const idemKey = (userId, key) => `${userId || '_'}::${key}`;

  // ---------- Response helpers ----------

  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const ok = (body) => json(200, body);
  const created = (body) => json(201, body);
  const errResp = (status, code, message) =>
    json(status, { error: code, message, requestId: 'demo' });
  const unauthorized = () => errResp(401, 'unauthorized', 'Authentication required');
  const forbidden = () => errResp(403, 'forbidden', 'Not allowed');
  const notFound = () => errResp(404, 'not_found', 'Not found');
  const conflict = (msg) => errResp(409, 'conflict', msg || 'Conflict');
  const badRequest = (msg) => errResp(400, 'bad_request', msg || 'Bad request');

  // Catch the AppError-shaped errors thrown by mock-store.
  const fromThrown = (err) => {
    const status = err.status || 500;
    const code = err.code || 'internal';
    return errResp(status, code, err.message || 'Demo error');
  };

  // ---------- Route table ----------

  // Each entry: [methodRegex, pathRegex, handler(req, match, body, headers)]
  // Path is matched against `path` (no querystring); query is on `req.url`.
  const Store = KR.MockStore;

  const routes = [
    // --- AUTH ---
    ['POST', /^\/auth\/register$/, async (_req, _m, body) => {
      const { email, password, name, phone, role } = body || {};
      if (!email || !password || !name || !role) return badRequest('Missing fields');
      if (!['CLIENT', 'CRAFTSMAN'].includes(role)) return badRequest('Invalid role');
      try {
        const user = Store.createUser({ email, password, name, phone, role });
        const accessToken = issueAccessToken(user.id);
        const refreshToken = `r.${user.id}.${Math.random().toString(36).slice(2)}`;
        Store.recordRefreshToken(refreshToken, user.id);
        return created({ user: Store.safeUser(user), accessToken, refreshToken });
      } catch (e) { return fromThrown(e); }
    }],
    ['POST', /^\/auth\/login$/, async (_req, _m, body) => {
      const { email, password } = body || {};
      const user = Store.findUserByEmail(email);
      if (!user || user.passwordHash !== password) return errResp(401, 'unauthorized', 'Invalid credentials');
      const accessToken = issueAccessToken(user.id);
      const refreshToken = `r.${user.id}.${Math.random().toString(36).slice(2)}`;
      Store.recordRefreshToken(refreshToken, user.id);
      return ok({ user: Store.safeUser(user), accessToken, refreshToken });
    }],
    ['POST', /^\/auth\/refresh$/, async (_req, _m, body) => {
      const { refreshToken } = body || {};
      const record = Store.findRefreshToken(refreshToken);
      if (!record) return unauthorized();
      const user = Store.findUserById(record.userId);
      if (!user) return unauthorized();
      const accessToken = issueAccessToken(user.id);
      const next = `r.${user.id}.${Math.random().toString(36).slice(2)}`;
      Store.revokeRefreshToken(refreshToken);
      Store.recordRefreshToken(next, user.id);
      return ok({ user: Store.safeUser(user), accessToken, refreshToken: next });
    }],
    ['POST', /^\/auth\/logout$/, async (_req, _m, body) => {
      if (body?.refreshToken) Store.revokeRefreshToken(body.refreshToken);
      return ok({});
    }],
    ['GET', /^\/auth\/me$/, async (_req, _m, _body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      return ok({ user: Store.safeUser(user) });
    }],

    // --- CATEGORIES ---
    ['GET', /^\/categories$/, async () => ok({ categories: Store.listCategories() })],

    // --- USERS ---
    ['PATCH', /^\/users\/me$/, async (_req, _m, body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      const updated = Store.updateUser(user.id, body || {});
      return ok({ user: Store.safeUser(updated) });
    }],
    ['PATCH', /^\/users\/me\/craftsman$/, async (_req, _m, body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      if (user.role !== 'CRAFTSMAN') return forbidden();
      const profile = Store.updateCraftsmanProfile(user.id, body || {});
      return ok({ profile });
    }],
    ['GET', /^\/users\/([^/]+)$/, async (_req, m) => {
      const target = Store.findUserById(decodeURIComponent(m[1]));
      if (!target) return notFound();
      return ok({ user: Store.publicUser(target) });
    }],
    ['GET', /^\/users\/([^/]+)\/reviews$/, async (_req, m) => {
      const id = decodeURIComponent(m[1]);
      return ok({ reviews: Store.listReviewsFor(id) });
    }],

    // --- JOBS ---
    ['GET', /^\/jobs$/, async (req, _m, _body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      const url = new URL(req.url, 'http://demo');
      const items = Store.listOpenJobs({
        categoryId: url.searchParams.get('categoryId') || undefined,
        city: url.searchParams.get('city') || undefined,
      });
      return ok({ items, nextCursor: null });
    }],
    ['GET', /^\/jobs\/me$/, async (_req, _m, _body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      return ok({ jobs: Store.listMyJobs(user.id) });
    }],
    ['POST', /^\/jobs$/, async (_req, _m, body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      if (user.role !== 'CLIENT') return forbidden();
      const idem = headers.get('Idempotency-Key');
      if (idem) {
        const cached = idempotency.get(idemKey(user.id, idem));
        if (cached) return ok(cached);
      }
      try {
        const job = Store.createJob(user.id, body || {});
        const payload = { job };
        if (idem) idempotency.set(idemKey(user.id, idem), payload);
        return created(payload);
      } catch (e) { return fromThrown(e); }
    }],
    ['GET', /^\/jobs\/([^/]+)$/, async (_req, m) => {
      const job = Store.getJob(decodeURIComponent(m[1]));
      if (!job) return notFound();
      return ok({ job });
    }],
    ['PATCH', /^\/jobs\/([^/]+)$/, async (_req, m, body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      const id = decodeURIComponent(m[1]);
      const job = Store.getJob(id);
      if (!job) return notFound();
      if (job.clientId !== user.id) return forbidden();
      const updated = Store.updateJob(id, body || {});
      return ok({ job: updated });
    }],
    ['POST', /^\/jobs\/([^/]+)\/(accept|start|complete|cancel)$/, async (_req, m, _body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      const id = decodeURIComponent(m[1]);
      const action = m[2];
      const job = Store.getJob(id);
      if (!job) return notFound();
      if (action === 'accept') {
        if (user.role !== 'CRAFTSMAN') return forbidden();
        const idem = headers.get('Idempotency-Key');
        if (idem) {
          const cached = idempotency.get(idemKey(user.id, idem));
          if (cached) return ok(cached);
        }
        try {
          const updated = Store.transitionJob(id, 'accept', user.id);
          const payload = { job: updated };
          if (idem) idempotency.set(idemKey(user.id, idem), payload);
          return ok(payload);
        } catch (e) { return fromThrown(e); }
      }
      // start / complete: must be the assigned craftsman
      if (action === 'start' || action === 'complete') {
        if (job.assignment?.craftsmanId !== user.id) return forbidden();
      }
      // cancel: client owner only
      if (action === 'cancel' && job.clientId !== user.id) return forbidden();
      try {
        const updated = Store.transitionJob(id, action, user.id);
        return ok({ job: updated });
      } catch (e) { return fromThrown(e); }
    }],

    // --- MESSAGES ---
    ['GET', /^\/jobs\/([^/]+)\/messages$/, async (_req, m, _body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      const id = decodeURIComponent(m[1]);
      const job = Store.getJob(id);
      if (!job) return notFound();
      const allowed = user.id === job.clientId || job.assignment?.craftsmanId === user.id;
      if (!allowed) return forbidden();
      return ok({ messages: Store.listMessages(id) });
    }],
    ['POST', /^\/jobs\/([^/]+)\/messages$/, async (_req, m, body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      const id = decodeURIComponent(m[1]);
      const job = Store.getJob(id);
      if (!job) return notFound();
      const allowed = user.id === job.clientId || job.assignment?.craftsmanId === user.id;
      if (!allowed) return forbidden();
      const content = String(body?.content || '').trim();
      if (!content) return badRequest('Empty message');
      const message = Store.sendMessage(id, user.id, content);
      return created({ message });
    }],

    // --- REVIEWS ---
    ['POST', /^\/jobs\/([^/]+)\/reviews$/, async (_req, m, body, headers) => {
      const user = userFromAuthHeader(headers);
      if (!user) return unauthorized();
      const id = decodeURIComponent(m[1]);
      try {
        const review = Store.createReview(id, user.id, body || {});
        return created({ review });
      } catch (e) { return fromThrown(e); }
    }],
  ];

  // ---------- Fetch override ----------

  const realFetch = window.fetch.bind(window);
  const API_PREFIX = '/api/';

  async function dispatch(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const u = new URL(url, location.origin);
    const path = u.pathname; // /api/...
    if (!path.startsWith(API_PREFIX)) {
      return realFetch(input, init);
    }

    const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || {});
    let body = null;
    if (init.body) {
      try { body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body; }
      catch (_) { body = null; }
    }

    const sub = path.slice(API_PREFIX.length - 1); // keep leading slash → "/auth/login"
    for (const [m, re, handler] of routes) {
      if (m !== method) continue;
      const match = sub.match(re);
      if (!match) continue;
      try {
        // Pass a synthesised request-ish object so handlers can read query.
        const req = { url: u.pathname + u.search, method };
        const res = await handler(req, match, body, headers);
        return res;
      } catch (e) {
        return fromThrown(e);
      }
    }
    return errResp(404, 'not_found', `No mock handler for ${method} ${sub}`);
  }

  window.fetch = (input, init) => dispatch(input, init);
  KR.MockApi = { active: true };
})();
