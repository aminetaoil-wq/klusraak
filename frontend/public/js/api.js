// Thin fetch wrapper. Reads access/refresh tokens from `Store`, transparently
// retries once after a 401 by refreshing. Two production niceties:
//   1. ETag round-trip: for safe GETs we keep <path -> {etag, body}> and
//      send `If-None-Match`; on 304 we reuse the cached body.
//   2. Idempotency-Key: createJob and acceptJob send a per-action UUID so a
//      retry on the network layer (401-refresh path included) collapses to
//      one server-side mutation.
(function () {
  const BASE = (window.KLUSRAAK_API_BASE || 'http://localhost:4000') + '/api';

  let refreshPromise = null;

  // Per-path ETag cache for GETs we know are safe to cache. Bounded by the
  // small set of endpoints that opt in below.
  const etagCache = new Map(); // path -> { etag, body }
  const cacheableGet = new Set([
    '/auth/me',
    '/categories',
  ]);
  const cacheablePrefix = (path) => path.startsWith('/jobs/') || path.startsWith('/users/');

  const isCacheableGet = (method, path) => {
    if (method !== 'GET') return false;
    return cacheableGet.has(path) || cacheablePrefix(path);
  };

  function uuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    // Fallback for very old browsers: 16-byte random hex.
    const b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  async function rawFetch(path, options = {}, attachAuth = true) {
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }
    if (attachAuth) {
      const token = window.Store?.accessToken;
      if (token) headers.set('Authorization', 'Bearer ' + token);
    }

    // ETag round-trip — only for safe GETs.
    const cached = isCacheableGet(method, path) ? etagCache.get(path) : null;
    if (cached?.etag) headers.set('If-None-Match', cached.etag);

    const res = await fetch(BASE + path, { ...options, headers });

    if (res.status === 304 && cached) {
      return cached.body;
    }

    let data = null;
    try { data = await res.json(); } catch (_) { /* empty body */ }

    if (!res.ok) {
      const err = new Error(data?.message || ('HTTP ' + res.status));
      err.status = res.status;
      err.code = data?.error;
      err.details = data?.details;
      err.requestId = data?.requestId;
      throw err;
    }

    if (isCacheableGet(method, path)) {
      const etag = res.headers.get('ETag');
      if (etag) etagCache.set(path, { etag, body: data });
    }
    return data;
  }

  async function refreshTokens() {
    const refreshToken = window.Store?.refreshToken;
    if (!refreshToken) throw new Error('Not authenticated');
    if (!refreshPromise) {
      refreshPromise = rawFetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, false).then((data) => {
        window.Store.setSession(data);
        return data;
      }).finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }

  async function request(path, options = {}, attachAuth = true) {
    try {
      return await rawFetch(path, options, attachAuth);
    } catch (err) {
      if (err.status === 401 && attachAuth && window.Store?.refreshToken) {
        try {
          await refreshTokens();
          return await rawFetch(path, options, true);
        } catch (refreshErr) {
          window.Store.clear();
          throw refreshErr;
        }
      }
      throw err;
    }
  }

  const json = (method) => (path, body, extraHeaders) =>
    request(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: extraHeaders,
    });

  // Wrap a mutation so the same Idempotency-Key is reused across the
  // automatic 401-refresh retry inside `request`.
  const idempotent = (fn) => (...args) => {
    const key = uuid();
    return fn(key, ...args);
  };

  window.API = {
    // Auth
    register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }, false),
    login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }, false),
    logout: (refreshToken) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false),
    me: () => request('/auth/me'),

    // Categories
    listCategories: () => request('/categories'),

    // Users
    updateMe: (body) => json('PATCH')('/users/me', body),
    updateCraftsman: (body) => json('PATCH')('/users/me/craftsman', body),
    getUser: (id) => request('/users/' + encodeURIComponent(id)),

    // Jobs
    listOpenJobs: (q = {}) => {
      const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== ''));
      const qs = params.toString();
      return request('/jobs' + (qs ? '?' + qs : ''));
    },
    listMyJobs: () => request('/jobs/me'),
    getJob: (id) => request('/jobs/' + encodeURIComponent(id)),
    createJob: idempotent((key, body) =>
      json('POST')('/jobs', body, { 'Idempotency-Key': key }),
    ),
    updateJob: (id, body) => json('PATCH')('/jobs/' + encodeURIComponent(id), body),
    acceptJob: idempotent((key, id) =>
      json('POST')('/jobs/' + encodeURIComponent(id) + '/accept', undefined, {
        'Idempotency-Key': key,
      }),
    ),
    startJob: (id) => json('POST')('/jobs/' + encodeURIComponent(id) + '/start'),
    completeJob: (id) => json('POST')('/jobs/' + encodeURIComponent(id) + '/complete'),
    cancelJob: (id) => json('POST')('/jobs/' + encodeURIComponent(id) + '/cancel'),

    // Messages + reviews (nested under job)
    listMessages: (jobId) => request('/jobs/' + encodeURIComponent(jobId) + '/messages'),
    sendMessage: (jobId, content) => json('POST')('/jobs/' + encodeURIComponent(jobId) + '/messages', { content }),
    createReview: (jobId, body) => json('POST')('/jobs/' + encodeURIComponent(jobId) + '/reviews', body),
  };

  const KR = (window.KR = window.KR || {});
  KR.API = window.API;
})();
