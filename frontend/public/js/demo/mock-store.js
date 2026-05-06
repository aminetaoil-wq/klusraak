// Mock data store for the static demo. Backed by localStorage so the
// user's actions survive a refresh. Plain-text passwords are intentional
// here — this is a demo, never a substitute for the real backend.
//
// Schema mirrors the Prisma models the frontend touches: users (with an
// optional craftsmanProfile), categories, jobs (with an optional
// assignment), messages, reviews. IDs are short cuid-ish strings.
(function () {
  const KEY = 'klusraak.mock.db.v3';

  const newId = (prefix) =>
    prefix + 'm' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  const empty = () => ({
    users: [],            // {id,email,passwordHash,name,phone,role,avatarUrl,createdAt,updatedAt,craftsmanProfile?}
    categories: [],       // {id,name,slug,icon,createdAt}
    jobs: [],             // {id,clientId,categoryId,title,description,city,postcode,budgetCents,scheduledAt,status,createdAt,updatedAt,assignment?}
    messages: [],         // {id,jobId,senderId,content,readAt,createdAt}
    reviews: [],          // {id,jobId,fromId,toId,rating,comment,createdAt}
    refreshTokens: [],    // {token,userId,revoked}
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      // Forward-compat: ensure all top-level arrays exist.
      const base = empty();
      for (const k of Object.keys(base)) if (!Array.isArray(parsed[k])) parsed[k] = base[k];
      return parsed;
    } catch (_) {
      return empty();
    }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  let db = load();
  const persist = () => save(db);

  // Reload from storage on every read so a second tab editing the same
  // localStorage is seen here. localStorage 'storage' events would also
  // work but only fire across tabs, not in the same tab.
  function refresh() { db = load(); }

  // ---------- Users ----------

  function findUserByEmail(email) {
    refresh();
    return db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
  }
  function findUserById(id) {
    refresh();
    return db.users.find((u) => u.id === id) || null;
  }
  function createUser({ email, password, name, phone, role }) {
    refresh();
    if (findUserByEmail(email)) {
      const err = new Error('Email already in use'); err.status = 409; err.code = 'conflict'; throw err;
    }
    const now = new Date().toISOString();
    const user = {
      id: newId('u_'),
      email,
      passwordHash: password, // plain — see header comment
      name,
      phone: phone || null,
      role,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    if (role === 'CRAFTSMAN') {
      user.craftsmanProfile = {
        id: newId('cp_'),
        userId: user.id,
        kvkNumber: null,
        bio: null,
        hourlyRate: null,
        city: null,
        verified: false,
        categories: [],
        createdAt: now,
        updatedAt: now,
      };
    }
    db.users.push(user);
    persist();
    return user;
  }
  function updateUser(id, patch) {
    refresh();
    const u = db.users.find((x) => x.id === id);
    if (!u) return null;
    if (patch.name !== undefined) u.name = patch.name;
    if (patch.phone !== undefined) u.phone = patch.phone;
    u.updatedAt = new Date().toISOString();
    persist();
    return u;
  }
  function updateCraftsmanProfile(userId, patch) {
    refresh();
    const u = db.users.find((x) => x.id === userId);
    if (!u || u.role !== 'CRAFTSMAN') return null;
    if (!u.craftsmanProfile) {
      u.craftsmanProfile = {
        id: newId('cp_'), userId: u.id, kvkNumber: null, bio: null, hourlyRate: null,
        city: null, verified: false, categories: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
    }
    const p = u.craftsmanProfile;
    if (patch.kvkNumber !== undefined) p.kvkNumber = patch.kvkNumber;
    if (patch.city !== undefined) p.city = patch.city;
    if (patch.bio !== undefined) p.bio = patch.bio;
    if (patch.hourlyRate !== undefined) p.hourlyRate = patch.hourlyRate;
    p.updatedAt = new Date().toISOString();
    persist();
    return p;
  }
  function publicUser(u) {
    if (!u) return null;
    return {
      id: u.id, name: u.name, role: u.role, avatarUrl: u.avatarUrl, createdAt: u.createdAt,
      craftsmanProfile: u.craftsmanProfile
        ? {
            kvkNumber: u.craftsmanProfile.kvkNumber,
            bio: u.craftsmanProfile.bio,
            hourlyRate: u.craftsmanProfile.hourlyRate,
            city: u.craftsmanProfile.city,
            verified: u.craftsmanProfile.verified,
          }
        : null,
    };
  }
  function safeUser(u) {
    if (!u) return null;
    const { passwordHash, ...rest } = u;
    return rest;
  }

  // ---------- Categories ----------

  function listCategories() {
    refresh();
    return db.categories.slice().sort((a, b) => a.name.localeCompare(b.name));
  }
  function findCategory(id) {
    refresh();
    return db.categories.find((c) => c.id === id) || null;
  }

  // ---------- Jobs ----------

  function jobWithIncludes(job) {
    if (!job) return null;
    const category = findCategory(job.categoryId);
    const out = {
      ...job,
      category: category ? { id: category.id, name: category.name, slug: category.slug, icon: category.icon } : null,
    };
    if (job.assignment) {
      const cm = findUserById(job.assignment.craftsmanId);
      out.assignment = {
        ...job.assignment,
        craftsman: cm ? { id: cm.id, name: cm.name, avatarUrl: cm.avatarUrl } : null,
      };
    }
    return out;
  }
  function listOpenJobs({ categoryId, city } = {}) {
    refresh();
    return db.jobs
      .filter((j) => j.status === 'OPEN')
      .filter((j) => !categoryId || j.categoryId === categoryId)
      .filter((j) => !city || j.city.toLowerCase() === String(city).toLowerCase())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(jobWithIncludes);
  }
  function listMyJobs(userId) {
    refresh();
    const u = findUserById(userId);
    if (!u) return [];
    const filter =
      u.role === 'CLIENT'
        ? (j) => j.clientId === userId
        : (j) => j.assignment && j.assignment.craftsmanId === userId;
    return db.jobs.filter(filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(jobWithIncludes);
  }
  function getJob(id) {
    refresh();
    const j = db.jobs.find((x) => x.id === id);
    return jobWithIncludes(j);
  }
  function createJob(clientId, body) {
    refresh();
    const cat = findCategory(body.categoryId);
    if (!cat) { const e = new Error('Category not found'); e.status = 400; e.code = 'bad_request'; throw e; }
    const now = new Date().toISOString();
    const job = {
      id: newId('j_'),
      clientId,
      categoryId: body.categoryId,
      title: body.title,
      description: body.description,
      city: body.city,
      postcode: body.postcode || null,
      budgetCents: body.budgetCents == null ? null : Number(body.budgetCents),
      scheduledAt: null,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    };
    db.jobs.push(job);
    persist();
    return jobWithIncludes(job);
  }
  function updateJob(id, patch) {
    refresh();
    const j = db.jobs.find((x) => x.id === id);
    if (!j) return null;
    for (const k of ['title', 'description', 'city', 'postcode', 'budgetCents']) {
      if (patch[k] !== undefined) j[k] = patch[k];
    }
    j.updatedAt = new Date().toISOString();
    persist();
    return jobWithIncludes(j);
  }
  function transitionJob(id, action, actorId) {
    refresh();
    const j = db.jobs.find((x) => x.id === id);
    if (!j) { const e = new Error('Job not found'); e.status = 404; e.code = 'not_found'; throw e; }
    const now = new Date().toISOString();
    if (action === 'accept') {
      if (j.status !== 'OPEN') { const e = new Error('Job not open'); e.status = 409; e.code = 'conflict'; throw e; }
      j.status = 'ASSIGNED';
      j.assignment = {
        id: newId('a_'),
        jobId: j.id,
        craftsmanId: actorId,
        acceptedAt: now,
        startedAt: null,
        completedAt: null,
      };
    } else if (action === 'start') {
      if (j.status !== 'ASSIGNED') { const e = new Error('Job not assigned'); e.status = 409; e.code = 'conflict'; throw e; }
      j.status = 'IN_PROGRESS';
      if (j.assignment) j.assignment.startedAt = now;
    } else if (action === 'complete') {
      if (j.status !== 'IN_PROGRESS') { const e = new Error('Job not in progress'); e.status = 409; e.code = 'conflict'; throw e; }
      j.status = 'COMPLETED';
      if (j.assignment) j.assignment.completedAt = now;
    } else if (action === 'cancel') {
      if (j.status === 'COMPLETED' || j.status === 'CANCELLED') {
        const e = new Error('Job already finalised'); e.status = 409; e.code = 'conflict'; throw e;
      }
      j.status = 'CANCELLED';
    }
    j.updatedAt = now;
    persist();
    return jobWithIncludes(j);
  }

  // ---------- Messages ----------

  function listMessages(jobId) {
    refresh();
    return db.messages
      .filter((m) => m.jobId === jobId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => {
        const sender = findUserById(m.senderId);
        return { ...m, sender: sender ? { id: sender.id, name: sender.name } : null };
      });
  }
  function sendMessage(jobId, senderId, content) {
    refresh();
    const job = db.jobs.find((x) => x.id === jobId);
    if (!job) { const e = new Error('Job not found'); e.status = 404; e.code = 'not_found'; throw e; }
    const now = new Date().toISOString();
    const message = { id: newId('msg_'), jobId, senderId, content, readAt: null, createdAt: now };
    db.messages.push(message);
    persist();
    const sender = findUserById(senderId);
    return { ...message, sender: sender ? { id: sender.id, name: sender.name } : null };
  }

  // ---------- Reviews ----------

  function createReview(jobId, fromId, body) {
    refresh();
    const job = db.jobs.find((x) => x.id === jobId);
    if (!job) { const e = new Error('Job not found'); e.status = 404; e.code = 'not_found'; throw e; }
    if (job.status !== 'COMPLETED') { const e = new Error('Job not completed'); e.status = 409; e.code = 'conflict'; throw e; }
    if (db.reviews.some((r) => r.jobId === jobId && r.fromId === fromId)) {
      const e = new Error('Already reviewed'); e.status = 409; e.code = 'conflict'; throw e;
    }
    const toId = fromId === job.clientId ? job.assignment?.craftsmanId : job.clientId;
    if (!toId) { const e = new Error('No counterparty'); e.status = 409; e.code = 'conflict'; throw e; }
    const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating))));
    const review = {
      id: newId('rv_'), jobId, fromId, toId, rating, comment: body.comment || null,
      createdAt: new Date().toISOString(),
    };
    db.reviews.push(review);
    persist();
    return review;
  }
  function listReviewsFor(userId) {
    refresh();
    return db.reviews
      .filter((r) => r.toId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const from = findUserById(r.fromId);
        return { ...r, from: from ? { id: from.id, name: from.name } : null };
      });
  }

  // ---------- Refresh tokens ----------

  function recordRefreshToken(token, userId) {
    refresh();
    db.refreshTokens.push({ token, userId, revoked: false });
    persist();
  }
  function findRefreshToken(token) {
    refresh();
    return db.refreshTokens.find((r) => r.token === token && !r.revoked) || null;
  }
  function revokeRefreshToken(token) {
    refresh();
    const r = db.refreshTokens.find((x) => x.token === token);
    if (r) { r.revoked = true; persist(); }
  }

  // ---------- Bulk seeding hook ----------

  function applySeed(seedFn) {
    refresh();
    const fresh = empty();
    db = fresh;
    seedFn({
      addCategory: (c) => db.categories.push({ ...c, createdAt: new Date().toISOString() }),
      addUser: (u) => db.users.push(u),
      addJob: (j) => db.jobs.push(j),
      addMessage: (m) => db.messages.push(m),
      addReview: (r) => db.reviews.push(r),
      newId,
    });
    persist();
  }

  function isSeeded() {
    refresh();
    return db.categories.length > 0 && db.users.length > 0;
  }

  const KR = (window.KR = window.KR || {});
  KR.MockStore = {
    findUserByEmail, findUserById, createUser, updateUser, updateCraftsmanProfile,
    publicUser, safeUser,
    listCategories, findCategory,
    listOpenJobs, listMyJobs, getJob, createJob, updateJob, transitionJob,
    listMessages, sendMessage,
    createReview, listReviewsFor,
    recordRefreshToken, findRefreshToken, revokeRefreshToken,
    applySeed, isSeeded, newId,
  };
})();
