// Per-screen render + form handlers. Pure orchestration — DOM helpers
// live in utils.js. Side-effects (chat polling) are tracked so we can
// clean up on navigation or tab background.
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const {
    escape, fmtMoney, fmtDate, initials,
    toast, jobCard, skeletonList, emptyState, friendlyError, submitLock,
    confirm: confirmDialog, animateCounters, refreshIcons,
    STATUS_LABELS, STATUS_BADGE,
  } = window.KR.utils;
  const { validate, clearFieldErrors } = window.KR.forms;

  // Used by services screen → new-job pre-fill.
  let pendingCategoryId = null;

  /* -------------------- AUTH -------------------- */

  let currentRole = 'CLIENT';

  function bindAuth() {
    $$('.rtab').forEach((t) =>
      t.addEventListener('click', () => {
        $$('.rtab').forEach((x) => {
          x.classList.remove('on');
          x.setAttribute('aria-selected', 'false');
        });
        t.classList.add('on');
        t.setAttribute('aria-selected', 'true');
        const isLogin = t.dataset.tab === 'login';
        $('#form-login').hidden = !isLogin;
        $('#form-register').hidden = isLogin;
      }),
    );

    $$('.oc[data-role]').forEach((card) =>
      card.addEventListener('click', () => {
        $$('.oc[data-role]').forEach((c) => {
          c.classList.remove('sel');
          c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('sel');
        card.setAttribute('aria-pressed', 'true');
        currentRole = card.dataset.role;
        $('input[name="role"]', $('#form-register')).value = currentRole;
      }),
    );
    const defaultRoleCard = $('.oc[data-role="CLIENT"]');
    if (defaultRoleCard) {
      defaultRoleCard.classList.add('sel');
      defaultRoleCard.setAttribute('aria-pressed', 'true');
    }

    $$('[data-toggle-pw]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.setAttribute('aria-pressed', String(!showing));
        btn.setAttribute('aria-label', showing ? 'Toon wachtwoord' : 'Verberg wachtwoord');
      }),
    );

    const loginForm = $('#form-login');
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(loginForm);
      const ok = validate(loginForm, {
        email: { required: true, type: 'email' },
        password: { required: true, minLength: 8, message: 'Wachtwoord is minimaal 8 tekens.' },
      });
      if (!ok) return;
      const fd = new FormData(loginForm);
      await submitLock(loginForm.querySelector('button[type="submit"]'), async () => {
        try {
          const data = await window.API.login({
            email: fd.get('email'),
            password: fd.get('password'),
          });
          window.Store.setSession(data);
          toast('Welkom terug, ' + data.user.name, { type: 'success' });
          window.Router.go('sc-dash');
        } catch (err) {
          toast(friendlyError(err), { type: 'error' });
        }
      });
    });

    const regForm = $('#form-register');
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(regForm);
      const ok = validate(regForm, {
        name: { required: true, minLength: 2 },
        email: { required: true, type: 'email' },
        password: { required: true, minLength: 8, message: 'Wachtwoord is minimaal 8 tekens.' },
      });
      if (!ok) return;
      const fd = new FormData(regForm);
      await submitLock(regForm.querySelector('button[type="submit"]'), async () => {
        try {
          const data = await window.API.register({
            email: fd.get('email'),
            password: fd.get('password'),
            name: fd.get('name'),
            phone: fd.get('phone') || undefined,
            role: fd.get('role'),
          });
          window.Store.setSession(data);
          toast('Account aangemaakt', { type: 'success' });
          window.Router.go('sc-dash');
        } catch (err) {
          toast(friendlyError(err), { type: 'error' });
        }
      });
    });
  }

  /* -------------------- HOME (services strip + counters) -------------------- */

  // Curated "most asked" services — order matches what we want on home.
  const POPULAR_SLUGS = [
    'klusjesman', 'loodgieter', 'elektricien', 'schilder',
    'hovenier', 'meubelmontage', 'schoonmaak', 'verhuizer',
  ];

  function renderHomeStrip() {
    const strip = $('#home-svc-strip');
    if (!strip) return;
    const all = window.Store.categories || [];
    if (all.length === 0) {
      strip.innerHTML = skeletonList(4);
      return;
    }
    const bySlug = new Map(all.map((c) => [c.slug, c]));
    const picks = POPULAR_SLUGS.map((s) => bySlug.get(s)).filter(Boolean);
    // Fill with extras if some slugs are missing (real backend without our seed).
    const extras = all.filter((c) => !POPULAR_SLUGS.includes(c.slug));
    while (picks.length < 8 && extras.length) picks.push(extras.shift());
    strip.innerHTML = picks
      .slice(0, 8)
      .map(
        (c) => `
          <button type="button" class="svc-tile" data-category-id="${escape(c.id)}" data-category-slug="${escape(c.slug || '')}" aria-label="Plaats ${escape(c.name)}-klus">
            <span class="svc-tile__icon" aria-hidden="true">${escape(c.icon || '🛠')}</span>
            <span class="svc-tile__name">${escape(c.name)}</span>
          </button>
        `,
      )
      .join('');
  }

  function onEnterHome() {
    renderHomeStrip();
    animateCounters();
    rotateLiveAvailability();
    const yr = $('#footer-year');
    if (yr) yr.textContent = String(new Date().getFullYear());
  }

  // Live availability — fake realtime "X vakmannen nu beschikbaar in <city>"
  // Rotates every 4-7s through a list of NL cities and varying counts.
  function rotateLiveAvailability() {
    const countEl = $('#hero-live-count');
    const cityEl  = $('#hero-live-city');
    const weekEl  = $('#hero-week-bookings');
    if (!countEl || !cityEl) return;
    if (window.__klusraakLiveTimer) return; // only one rotator
    const cities = ['Amersfoort', 'Amsterdam', 'Utrecht', 'Den Haag', 'Rotterdam', 'Eindhoven', 'Haarlem', 'Groningen', 'Almere', 'Tilburg'];
    const counts = [3, 4, 5, 6, 7, 8, 9, 11, 12];
    const tick = () => {
      countEl.textContent = String(counts[Math.floor(Math.random() * counts.length)]);
      cityEl.textContent  = cities[Math.floor(Math.random() * cities.length)];
      if (weekEl) {
        const base = 124;
        weekEl.textContent = String(base + Math.floor(Math.random() * 12));
      }
    };
    tick();
    window.__klusraakLiveTimer = setInterval(tick, 4500 + Math.random() * 2500);
  }

  /* -------------------- SERVICES (discovery) -------------------- */

  function groupedCategories() {
    const cats = (window.Store.categories || []).slice();
    const groupOrder = window.KR.SERVICE_GROUPS || [];
    const groups = new Map();
    groupOrder.forEach((g) => groups.set(g, []));
    cats.forEach((c) => {
      const g = c.group || 'Overig';
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(c);
    });
    return Array.from(groups.entries()).filter(([, list]) => list.length > 0);
  }

  function renderServicesList(filter = '') {
    const out = $('#services-results');
    if (!out) return;
    const q = filter.trim().toLowerCase();
    const groups = groupedCategories().map(([g, list]) => [
      g,
      q
        ? list.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              (c.desc || '').toLowerCase().includes(q) ||
              g.toLowerCase().includes(q),
          )
        : list,
    ]).filter(([, list]) => list.length > 0);

    if (groups.length === 0) {
      out.innerHTML = emptyState({
        icon: 'search-x',
        title: 'Geen dienst gevonden',
        body: q ? `We konden geen dienst vinden voor "${escape(q)}".` : 'Probeer een ander zoekwoord.',
      });
      refreshIcons();
      return;
    }

    out.innerHTML = groups
      .map(([g, list]) => {
        const items = list
          .map(
            (c) => `
              <button type="button" class="svc-card" data-category-id="${escape(c.id)}">
                <span class="svc-card__icon" aria-hidden="true">${escape(c.icon || '🛠')}</span>
                <span class="svc-card__body">
                  <span class="svc-card__name">${escape(c.name)}</span>
                  <span class="svc-card__avail">${escape(c.desc || '')} · ≥${c.avail || 8} vakmannen beschikbaar</span>
                </span>
              </button>
            `,
          )
          .join('');
        return `
          <details class="svc-group" open>
            <summary>
              <span class="svc-group__title">${escape(g)}</span>
              <span class="svc-group__count">${list.length} ${list.length === 1 ? 'dienst' : 'diensten'}</span>
            </summary>
            <div class="svc-group__grid">${items}</div>
          </details>
        `;
      })
      .join('');
    refreshIcons();
  }

  function onEnterServices() {
    if (!window.Store.categories || window.Store.categories.length === 0) {
      $('#services-results').innerHTML = skeletonList(6);
      window.API.listCategories()
        .then(({ categories }) => {
          window.Store.categories = categories;
          renderServicesList($('#services-search')?.value || '');
        })
        .catch(() => {
          renderServicesList();
        });
    } else {
      renderServicesList($('#services-search')?.value || '');
    }
  }

  function bindServices() {
    const search = $('#services-search');
    if (search) {
      let t;
      search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => renderServicesList(search.value), 120);
      });
    }
  }

  /* -------------------- DASHBOARD -------------------- */

  async function renderDashboard() {
    const body = $('#dash-body');
    const user = window.Store.user;
    if (!user) return;

    body.innerHTML = `
      <h1 class="visually-hidden" tabindex="-1">Dashboard</h1>
      <div class="hbg" style="padding:28px;border-radius:var(--radius-xl);overflow:hidden;position:relative;border:1px solid var(--line-2);box-shadow:var(--shadow-sm),var(--rim-light);">
        <div style="position:relative;z-index:1;">
          <span class="badge bo">${user.role === 'CLIENT' ? 'Klant' : 'Vakman'}</span>
          <h2 class="h2 mt12">Hoi ${escape(user.name.split(' ')[0])}.</h2>
          <p class="lead mt8">${
            user.role === 'CLIENT'
              ? 'Klaar om een klus uit te zetten? We vinden binnen 30 min een vakman.'
              : 'Bekijk welke klussen vandaag op je wachten — accepteer met één tik.'
          }</p>
          <div class="flex fw g10 mt16">
            ${
              user.role === 'CLIENT'
                ? '<button type="button" class="btn btn-primary" data-go="sc-new"><i data-lucide="plus"></i>Nieuwe klus</button><button type="button" class="btn btn-outline" data-go="sc-services">Bekijk diensten</button>'
                : '<button type="button" class="btn btn-primary" data-go="sc-jobs">Open klussen</button>'
            }
          </div>
        </div>
      </div>

      <div class="sec-label mt32">Recent</div>
      <div class="grid-2" id="dash-recent">${skeletonList(3)}</div>
    `;
    refreshIcons();

    try {
      const { jobs } = await window.API.listMyJobs();
      const recent = jobs.slice(0, 6);
      const list = $('#dash-recent');
      list.innerHTML =
        recent.length === 0
          ? emptyState({
              icon: user.role === 'CLIENT' ? 'inbox' : 'briefcase',
              title: user.role === 'CLIENT' ? 'Nog geen klussen' : 'Nog geen actieve klussen',
              body:
                user.role === 'CLIENT'
                  ? 'Plaats je eerste klus en de eerste vakman in de buurt pakt hem op.'
                  : 'Bekijk de lijst met openstaande klussen om te beginnen.',
              actionLabel: user.role === 'CLIENT' ? 'Plaats nieuwe klus' : 'Naar open klussen',
              onAction: () => window.Router.go(user.role === 'CLIENT' ? 'sc-new' : 'sc-jobs'),
            })
          : recent.map((j) => jobCard(j)).join('');
      refreshIcons();
    } catch (err) {
      $('#dash-recent').innerHTML = emptyState({
        icon: 'alert-triangle',
        title: 'Klussen niet geladen',
        body: friendlyError(err),
      });
      refreshIcons();
    }
  }

  /* -------------------- JOBS LIST -------------------- */

  let activeCategory = null;

  async function renderJobs() {
    const isCraftsman = window.Store.isCraftsman();
    $('#jobs-title').textContent = isCraftsman ? 'Open klussen' : 'Mijn klussen';

    const chips = $('#jobs-chips');
    if (isCraftsman) {
      const cats = window.Store.categories || [];
      chips.innerHTML =
        '<button type="button" class="chip ' +
        (activeCategory == null ? 'on' : '') +
        '" data-cat="" aria-pressed="' +
        (activeCategory == null ? 'true' : 'false') +
        '">Alle</button>' +
        cats
          .slice(0, 16)
          .map(
            (c) =>
              `<button type="button" class="chip ${activeCategory === c.id ? 'on' : ''}" data-cat="${escape(c.id)}" aria-pressed="${activeCategory === c.id ? 'true' : 'false'}">${escape(c.icon || '')} ${escape(c.name)}</button>`,
          )
          .join('');
      $$('.chip', chips).forEach((chip) =>
        chip.addEventListener('click', () => {
          activeCategory = chip.dataset.cat || null;
          renderJobs();
        }),
      );
    } else {
      chips.innerHTML = '';
    }

    const list = $('#jobs-list');
    list.innerHTML = skeletonList(4);
    try {
      const data = isCraftsman
        ? await window.API.listOpenJobs({ categoryId: activeCategory || undefined })
        : await window.API.listMyJobs();
      const jobs = isCraftsman ? data.items : data.jobs;
      if (!jobs || jobs.length === 0) {
        list.innerHTML = emptyState({
          icon: isCraftsman ? 'search-x' : 'list-checks',
          title: isCraftsman ? 'Geen open klussen' : 'Nog geen klussen geplaatst',
          body: isCraftsman
            ? 'Probeer een andere categorie of kijk later opnieuw.'
            : 'Plaats je eerste klus en de eerste vakman pakt hem op.',
          actionLabel: isCraftsman ? null : 'Nieuwe klus',
          onAction: isCraftsman ? null : () => window.Router.go('sc-new'),
        });
        refreshIcons();
        return;
      }
      list.innerHTML = jobs.map((j) => jobCard(j)).join('');
    } catch (err) {
      list.innerHTML = emptyState({
        icon: 'alert-triangle',
        title: 'Klussen niet geladen',
        body: friendlyError(err),
      });
      refreshIcons();
    }
  }

  /* -------------------- NEW JOB -------------------- */

  async function renderNewJob() {
    const sel = $('#newjob-category');
    if (!window.Store.categories || window.Store.categories.length === 0) {
      try {
        const { categories } = await window.API.listCategories();
        window.Store.categories = categories;
      } catch (_) { /* offline ok */ }
    }
    sel.innerHTML = (window.Store.categories || [])
      .map((c) => `<option value="${escape(c.id)}">${escape(c.icon || '')} ${escape(c.name)}</option>`)
      .join('');
    if (pendingCategoryId) {
      sel.value = pendingCategoryId;
      pendingCategoryId = null;
    }
    syncNewJobSummary();
  }

  // Heuristic price ranges per category slug — purely demo, no real pricing.
  const PRICE_HINTS = {
    elektricien: [60, 180], loodgieter: [60, 180], airco: [120, 320],
    hovenier: [80, 240], tegelzetter: [180, 800], dakgootreiniging: [80, 160],
    meubelmontage: [60, 180], 'it-hulp': [50, 140], schilder: [180, 600],
    klusjesman: [60, 200], verhuizer: [120, 400], aannemer: [400, 2500],
    cv_monteur: [80, 220], boilerinstallateur: [150, 600], dakdekker: [180, 1200],
  };
  function priceRangeFor(catSlug) {
    return PRICE_HINTS[catSlug] || [60, 200];
  }
  function fmtRange([lo, hi]) {
    return `€${lo} – €${hi}`;
  }

  // Live sync of sticky summary + price hint + progress on sc-new.
  function syncNewJobSummary() {
    const form = $('#form-new-job');
    if (!form) return;
    const sel = $('#newjob-category');
    const opt = sel ? sel.options[sel.selectedIndex] : null;
    const cat = (window.Store.categories || []).find((c) => c.id === (sel && sel.value));
    const title = $('#newjob-title') ? $('#newjob-title').value.trim() : '';
    const desc = $('#newjob-description') ? $('#newjob-description').value.trim() : '';
    const city = $('#newjob-city') ? $('#newjob-city').value.trim() : '';

    if ($('#sum-category')) $('#sum-category').textContent = cat ? `${cat.icon || ''} ${cat.name}`.trim() : '—';
    if ($('#sum-title')) $('#sum-title').textContent = title || '—';
    if ($('#sum-city')) $('#sum-city').textContent = city || '—';

    const range = cat ? priceRangeFor(cat.slug) : null;
    const priceText = range ? fmtRange(range) : '€ —';
    if ($('#sum-price')) $('#sum-price').textContent = priceText;

    const hintBox = $('#newjob-price-hint');
    if (hintBox) {
      if (range) {
        hintBox.hidden = false;
        $('#newjob-price-range').textContent = fmtRange(range);
      } else {
        hintBox.hidden = true;
      }
    }

    // Progress: 4 fields (category, title, description, city) — count filled.
    const filled = [sel && sel.value, title.length >= 4, desc.length >= 10, city.length >= 2].filter(Boolean).length;
    const pct = Math.round((filled / 4) * 100);
    if ($('#sum-progress-num')) $('#sum-progress-num').textContent = `${pct}% klaar`;
    if ($('#sum-progress-bar')) $('#sum-progress-bar').style.width = pct + '%';
  }

  function bindNewJob() {
    const form = $('#form-new-job');
    // Live update sticky summary on every change/input
    ['change', 'input'].forEach((ev) => form.addEventListener(ev, syncNewJobSummary));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const ok = validate(form, {
        categoryId: { required: true },
        title: { required: true, minLength: 4, maxLength: 120 },
        description: { required: true, minLength: 10, maxLength: 5000 },
        city: { required: true, minLength: 2 },
      });
      if (!ok) return;
      const fd = new FormData(form);
      const budgetEuro = fd.get('budgetEuro');
      const payload = {
        categoryId: fd.get('categoryId'),
        title: fd.get('title'),
        description: fd.get('description'),
        city: fd.get('city'),
        postcode: fd.get('postcode') || undefined,
        budgetCents: budgetEuro ? Math.round(Number(budgetEuro) * 100) : undefined,
      };
      await submitLock(form.querySelector('button[type="submit"]'), async () => {
        try {
          const { job } = await window.API.createJob(payload);
          toast('Klus geplaatst', { type: 'success' });
          form.reset();
          window.Store.currentJobId = job.id;
          window.Router.go('sc-job');
        } catch (err) {
          toast(friendlyError(err), { type: 'error' });
        }
      });
    });
  }

  /* -------------------- JOB DETAIL -------------------- */

  async function renderJob() {
    const id = window.Store.currentJobId;
    const body = $('#job-body');
    if (!id) {
      body.innerHTML = emptyState({
        icon: 'inbox',
        title: 'Geen klus geselecteerd',
        body: 'Kies een klus uit de lijst.',
        actionLabel: 'Naar klussen',
        onAction: () => window.Router.go('sc-jobs'),
      });
      refreshIcons();
      return;
    }
    body.innerHTML = '<h1 class="visually-hidden" tabindex="-1">Klus details</h1>' + skeletonList(3);
    try {
      const { job } = await window.API.getJob(id);
      const isClient = window.Store.user?.id === job.clientId;
      const isAssignedCraftsman = job.assignment?.craftsmanId === window.Store.user?.id;
      const status = STATUS_LABELS[job.status] || job.status;
      const cls = STATUS_BADGE[job.status] || 'bx';

      const actions = [];
      if (job.status === 'OPEN' && window.Store.isCraftsman()) {
        actions.push('<button type="button" class="btn btn-primary btn-full" data-act="accept">Klus accepteren</button>');
      }
      if (job.status === 'ASSIGNED' && isAssignedCraftsman) {
        actions.push('<button type="button" class="btn btn-primary btn-full" data-act="start">Start klus</button>');
      }
      if (job.status === 'IN_PROGRESS' && isAssignedCraftsman) {
        actions.push('<button type="button" class="btn btn-success btn-full" data-act="complete">Markeer afgerond</button>');
      }
      if (isClient && (job.status === 'OPEN' || job.status === 'ASSIGNED' || job.status === 'IN_PROGRESS')) {
        actions.push('<button type="button" class="btn btn-danger btn-full" data-act="cancel">Annuleer klus</button>');
      }
      if (job.assignment && (isClient || isAssignedCraftsman)) {
        actions.unshift('<button type="button" class="btn btn-secondary btn-full" data-act="chat" aria-label="Chat openen"><i data-lucide="message-circle"></i>Chat openen</button>');
      }

      let reviewBlock = '';
      if (job.status === 'COMPLETED' && (isClient || isAssignedCraftsman)) {
        reviewBlock = `
          <form class="card mt12" id="form-review" novalidate>
            <h3 class="h4">Beoordeel je ${isClient ? 'vakman' : 'klant'}</h3>
            <div class="fg mt8">
              <label for="review-rating">Score (1–5)<span class="req" aria-hidden="true">*</span></label>
              <input type="number" id="review-rating" name="rating" min="1" max="5" required aria-required="true" value="5" inputmode="numeric" />
            </div>
            <div class="fg mt8">
              <label for="review-comment">Opmerking</label>
              <textarea id="review-comment" name="comment" rows="2" placeholder="Optioneel"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full mt12">Verstuur beoordeling</button>
          </form>
        `;
      }

      body.innerHTML = `
        <h1 id="job-title" class="visually-hidden" tabindex="-1">${escape(job.title)}</h1>
        <div class="flex jb ac">
          <span class="badge ${cls}">${escape(status)}</span>
          <span class="xs">${escape(fmtDate(job.createdAt))}</span>
        </div>
        <h2 class="h2 mt12">${escape(job.title)}</h2>
        <p class="sm mt4">${escape(job.category?.name || '')} · ${escape(job.city)}${job.postcode ? ' · ' + escape(job.postcode) : ''}</p>
        <div class="card mt16">
          <div class="h4">Beschrijving</div>
          <p class="sm mt8" style="white-space:pre-wrap;color:var(--tx);">${escape(job.description)}</p>
        </div>
        <div class="card mt12">
          <div class="flex jb ac">
            <span class="sm">Budget</span>
            <span class="h3">${escape(fmtMoney(job.budgetCents))}</span>
          </div>
        </div>
        ${
          job.assignment
            ? `<div class="card mt12">
                <div class="sec-label">Toegewezen aan</div>
                <div class="flex ac g12 mt4">
                  <div class="av">${escape(initials(job.assignment.craftsman?.name))}</div>
                  <div>
                    <div class="h4">${escape(job.assignment.craftsman?.name || '')}</div>
                    <div class="xs">Geaccepteerd ${escape(fmtDate(job.assignment.acceptedAt))}</div>
                  </div>
                </div>
              </div>`
            : ''
        }
        <div class="flex fc g8 mt16">${actions.join('')}</div>
        ${reviewBlock}
      `;
      refreshIcons();

      body.querySelectorAll('[data-act]').forEach((btn) =>
        btn.addEventListener('click', async () => {
          const act = btn.dataset.act;
          if (act === 'chat') return window.Router.go('sc-chat');
          if (act === 'cancel') {
            const ok = await confirmDialog({
              title: 'Klus annuleren?',
              message: 'Deze klus wordt geannuleerd. Dit kan niet ongedaan gemaakt worden.',
              confirmLabel: 'Ja, annuleren',
              cancelLabel: 'Toch niet',
              danger: true,
            });
            if (!ok) return;
          }
          await submitLock(btn, async () => {
            try {
              if (act === 'accept') await window.API.acceptJob(id);
              if (act === 'start') await window.API.startJob(id);
              if (act === 'complete') await window.API.completeJob(id);
              if (act === 'cancel') await window.API.cancelJob(id);
              toast('Bijgewerkt', { type: 'success' });
              renderJob();
            } catch (err) {
              toast(friendlyError(err), { type: 'error' });
            }
          });
        }),
      );

      const reviewForm = body.querySelector('#form-review');
      if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          clearFieldErrors(reviewForm);
          const ok = validate(reviewForm, {
            rating: { required: true, min: 1, max: 5 },
          });
          if (!ok) return;
          const fd = new FormData(reviewForm);
          await submitLock(reviewForm.querySelector('button[type="submit"]'), async () => {
            try {
              await window.API.createReview(id, {
                rating: Number(fd.get('rating')),
                comment: fd.get('comment') || undefined,
              });
              toast('Beoordeling verstuurd', { type: 'success' });
              renderJob();
            } catch (err) {
              toast(friendlyError(err), { type: 'error' });
            }
          });
        });
      }
    } catch (err) {
      body.innerHTML = emptyState({
        icon: 'alert-triangle',
        title: 'Klus niet geladen',
        body: friendlyError(err),
      });
      refreshIcons();
    }
    refreshIcons();
  }

  /* -------------------- CHAT -------------------- */

  const POLL_MS = 4000;
  let chatPoll = null;
  let chatRefresh = null;

  function startChatPolling() {
    if (chatPoll || !chatRefresh) return;
    chatPoll = setInterval(chatRefresh, POLL_MS);
  }
  function stopChatPolling() {
    if (chatPoll) {
      clearInterval(chatPoll);
      chatPoll = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (window.Router.current !== 'sc-chat') return;
    if (document.hidden) stopChatPolling();
    else startChatPolling();
  });

  async function renderChat() {
    const id = window.Store.currentJobId;
    const thread = $('#chat-thread');
    const newPill = $('#chat-new-pill');
    if (!id) {
      thread.innerHTML = emptyState({
        icon: 'message-circle',
        title: 'Geen klus geselecteerd',
        body: 'Open eerst een klus om te chatten.',
      });
      refreshIcons();
      return;
    }

    const isAtBottom = () =>
      thread.scrollTop + thread.clientHeight >= thread.scrollHeight - 60;

    let lastCount = 0;
    chatRefresh = async function refresh() {
      try {
        const { messages } = await window.API.listMessages(id);
        const wasAtBottom = isAtBottom();
        thread.innerHTML = messages
          .map((m) => {
            const mine = m.senderId === window.Store.user?.id;
            return `
              <div class="flex ${mine ? 'je' : ''}">
                <div class="chat-bubble ${mine ? 'cb-out' : 'cb-in'}">
                  ${!mine ? `<div class="chat-sender">${escape(m.sender?.name || '')}</div>` : ''}
                  ${escape(m.content)}
                </div>
              </div>`;
          })
          .join('') || '<div class="empty-state"><div class="empty-state__icon" aria-hidden="true"><i data-lucide="message-circle"></i></div><h3 class="empty-state__title">Begin een gesprek</h3><p class="empty-state__body">Stel je vraag of laat een update achter.</p></div>';

        const grew = messages.length > lastCount;
        lastCount = messages.length;
        if (wasAtBottom) {
          thread.scrollTop = thread.scrollHeight;
          if (newPill) newPill.hidden = true;
        } else if (grew && newPill) {
          newPill.hidden = false;
        }
        refreshIcons();
      } catch (err) {
        thread.innerHTML = emptyState({
          icon: 'alert-triangle',
          title: 'Chat niet geladen',
          body: friendlyError(err),
        });
        refreshIcons();
      }
    };

    await chatRefresh();
    stopChatPolling();
    startChatPolling();

    if (newPill) {
      newPill.onclick = () => {
        thread.scrollTop = thread.scrollHeight;
        newPill.hidden = true;
      };
    }

    const form = $('#chat-form');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input[name="content"]');
      const content = input.value.trim();
      if (!content) return;
      input.value = '';
      await submitLock(form.querySelector('button[type="submit"]'), async () => {
        try {
          await window.API.sendMessage(id, content);
          await chatRefresh();
          thread.scrollTop = thread.scrollHeight;
        } catch (err) {
          toast(friendlyError(err), { type: 'error' });
        }
      });
    };
  }

  function leaveChat() {
    stopChatPolling();
    chatRefresh = null;
  }

  /* -------------------- PROFILE -------------------- */

  async function renderProfile() {
    const body = $('#profile-body');
    const u = window.Store.user;
    if (!u) return;

    let profile = null;
    if (u.role === 'CRAFTSMAN') {
      try {
        const { user } = await window.API.me();
        window.Store.setUser(user);
        profile = user.craftsmanProfile || null;
      } catch (_) { /* keep going */ }
    }

    body.innerHTML = `
      <h1 id="profile-title" class="visually-hidden" tabindex="-1">Profiel</h1>
      <div class="flex ac g12">
        <div class="av av-lg">${escape(initials(u.name))}</div>
        <div>
          <div class="h3">${escape(u.name)}</div>
          <div class="sm">${escape(u.email)}</div>
        </div>
      </div>

      <form class="card mt16" id="form-me" novalidate>
        <div class="sec-label">Account</div>
        <div class="fg mt8">
          <label for="me-name">Naam</label>
          <input type="text" id="me-name" name="name" value="${escape(u.name)}" />
        </div>
        <div class="fg mt8">
          <label for="me-phone">Telefoon</label>
          <input type="tel" id="me-phone" name="phone" value="${escape(u.phone || '')}" autocomplete="tel" />
        </div>
        <button type="submit" class="btn btn-primary btn-full mt12">Opslaan</button>
      </form>

      ${
        u.role === 'CRAFTSMAN'
          ? `<form class="card mt12" id="form-craftsman" novalidate>
              <div class="sec-label">Vakman-profiel</div>
              <div class="fg mt8">
                <label for="cm-kvk">KvK</label>
                <input type="text" id="cm-kvk" name="kvkNumber" value="${escape(profile?.kvkNumber || '')}" inputmode="numeric" />
              </div>
              <div class="fg mt8">
                <label for="cm-city">Stad</label>
                <input type="text" id="cm-city" name="city" value="${escape(profile?.city || '')}" />
              </div>
              <div class="fg mt8">
                <label for="cm-rate">Uurtarief (€)</label>
                <input type="number" id="cm-rate" name="hourlyRateEuro" min="0" step="1" value="${
                  profile?.hourlyRate != null ? (profile.hourlyRate / 100).toFixed(0) : ''
                }" inputmode="numeric" />
              </div>
              <div class="fg mt8">
                <label for="cm-bio">Bio</label>
                <textarea id="cm-bio" name="bio" rows="3" placeholder="Vertel iets over jezelf">${escape(profile?.bio || '')}</textarea>
              </div>
              <button type="submit" class="btn btn-primary btn-full mt12">Profiel bijwerken</button>
            </form>`
          : ''
      }

      <button type="button" class="btn btn-danger btn-full mt16" data-action="logout">Uitloggen</button>
    `;

    const me = $('#form-me');
    me.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(me);
      const ok = validate(me, { name: { minLength: 2 } });
      if (!ok) return;
      const fd = new FormData(me);
      await submitLock(me.querySelector('button[type="submit"]'), async () => {
        try {
          const { user } = await window.API.updateMe({
            name: fd.get('name') || undefined,
            phone: fd.get('phone') || undefined,
          });
          window.Store.setUser({ ...window.Store.user, ...user });
          toast('Opgeslagen', { type: 'success' });
        } catch (err) {
          toast(friendlyError(err), { type: 'error' });
        }
      });
    });

    const cf = $('#form-craftsman');
    if (cf) {
      cf.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors(cf);
        const fd = new FormData(cf);
        const hourly = fd.get('hourlyRateEuro');
        await submitLock(cf.querySelector('button[type="submit"]'), async () => {
          try {
            await window.API.updateCraftsman({
              kvkNumber: fd.get('kvkNumber') || undefined,
              city: fd.get('city') || undefined,
              hourlyRate: hourly ? Math.round(Number(hourly) * 100) : undefined,
              bio: fd.get('bio') || undefined,
            });
            toast('Profiel bijgewerkt', { type: 'success' });
          } catch (err) {
            toast(friendlyError(err), { type: 'error' });
          }
        });
      });
    }
  }

  /* -------------------- DELEGATION -------------------- */

  // Job-card clicks → open detail.
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-job-id]');
    if (card) {
      window.Store.currentJobId = card.dataset.jobId;
      window.Router.go('sc-job');
      return;
    }
    // Service tile / card → start new job with category preselected.
    const svc = e.target.closest('[data-category-id]');
    if (svc) {
      pendingCategoryId = svc.dataset.categoryId;
      // If unauthenticated, route through register flow (acts on category later).
      if (!window.Store.isAuthed()) {
        const tab = document.querySelector('.rtab[data-tab="register"]');
        if (tab) tab.click();
        const card = document.querySelector('.oc[data-role="CLIENT"]');
        if (card) card.click();
        window.Router.go('sc-auth');
        return;
      }
      window.Router.go('sc-new');
    }
  });

  // Per-screen entry hooks.
  const ENTER_HOOKS = {
    'sc-home': onEnterHome,
    'sc-services': onEnterServices,
    'sc-dash': renderDashboard,
    'sc-jobs': renderJobs,
    'sc-new': renderNewJob,
    'sc-job': renderJob,
    'sc-chat': renderChat,
    'sc-profile': renderProfile,
  };

  window.addEventListener('screen:enter', (e) => {
    const id = e.detail.id;
    if (id !== 'sc-chat') leaveChat();
    const hook = ENTER_HOOKS[id];
    if (hook) hook();
  });

  document.addEventListener('DOMContentLoaded', () => {
    bindAuth();
    bindNewJob();
    bindServices();
  });
})();
