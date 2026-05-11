// Shared helpers — pure functions, snackbar, modal, skeletons, validation,
// theme. Single namespace `KR` to keep the global scope clean.
(function () {
  const KR = (window.KR = window.KR || {});

  /* ---------------- Constants ---------------- */

  const STATUS_LABELS = {
    OPEN: 'Open',
    ASSIGNED: 'Toegewezen',
    IN_PROGRESS: 'Bezig',
    COMPLETED: 'Afgerond',
    CANCELLED: 'Geannuleerd',
  };
  const STATUS_BADGE = {
    OPEN: 'bo',
    ASSIGNED: 'bb',
    IN_PROGRESS: 'bb',
    COMPLETED: 'bg',
    CANCELLED: 'bx',
  };

  /* ---------------- Pure helpers ---------------- */

  const escape = (str = '') =>
    String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[m]);

  const fmtMoney = (cents) => (cents == null ? '—' : '€' + (cents / 100).toFixed(2));

  const fmtDate = (d) =>
    new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(d));

  const initials = (name = '') =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?';

  const prefersReducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Snackbar (toast) ---------------- */

  let snackTimer = null;
  let snackEl = null;
  function ensureSnackbar() {
    if (snackEl) return snackEl;
    snackEl =
      document.getElementById('snackbar') ||
      document.getElementById('toast');
    return snackEl;
  }

  // toast(msg) → simple
  // toast(msg, true) → error (back-compat with old call sites)
  // toast(msg, { type, actionLabel, onAction, duration })
  function toast(msg, opts) {
    const el = ensureSnackbar();
    if (!el) return;
    let type = 'info';
    let actionLabel = null;
    let onAction = null;
    let duration = 3600;
    if (opts === true) type = 'error';
    else if (opts && typeof opts === 'object') {
      type = opts.type || 'info';
      actionLabel = opts.actionLabel || null;
      onAction = typeof opts.onAction === 'function' ? opts.onAction : null;
      duration = opts.duration || 3600;
    }

    el.classList.remove('on', 'err', 'success', 'info');
    el.classList.add(type === 'error' ? 'err' : type);

    const text = `<span class="snack-msg">${escape(msg)}</span>`;
    const action = actionLabel
      ? `<button type="button" class="snack-action">${escape(actionLabel)}</button>`
      : '';
    el.innerHTML = text + action;

    if (actionLabel && onAction) {
      const btn = el.querySelector('.snack-action');
      btn?.addEventListener(
        'click',
        () => {
          try { onAction(); } finally { hideSnack(); }
        },
        { once: true },
      );
    }

    requestAnimationFrame(() => el.classList.add('on'));
    clearTimeout(snackTimer);
    snackTimer = setTimeout(hideSnack, duration);
  }

  function hideSnack() {
    const el = ensureSnackbar();
    if (el) el.classList.remove('on');
  }

  /* ---------------- Lucide icon refresh ---------------- */

  // Lucide is loaded via CDN at end of body. Calling createIcons() walks
  // the DOM for `<i data-lucide="...">` and swaps in inline SVGs. Safe to
  // call repeatedly — already-rendered icons are skipped.
  function refreshIcons() {
    if (typeof window.lucide?.createIcons !== 'function') return;
    try { window.lucide.createIcons(); } catch (_) { /* no-op */ }
  }

  /* ---------------- Skeletons ---------------- */

  function skeletonList(n = 3) {
    return Array.from({ length: n })
      .map(
        () => `
        <div class="skel skel--card" aria-hidden="true">
          <div class="skel--line" style="width:35%;"></div>
          <div class="skel--line" style="width:80%;margin-top:10px;"></div>
          <div class="skel--line" style="width:55%;margin-top:8px;"></div>
        </div>
      `,
      )
      .join('');
  }

  /* ---------------- Empty state ---------------- */

  function emptyState({ icon = 'package', title = '', body = '', actionLabel, onAction } = {}) {
    const id = 'empty-' + Math.random().toString(36).slice(2, 8);
    const html = `
      <div class="empty-state">
        <div class="empty-state__icon" aria-hidden="true"><i data-lucide="${escape(icon)}"></i></div>
        ${title ? `<h3 class="empty-state__title">${escape(title)}</h3>` : ''}
        ${body ? `<p class="empty-state__body">${escape(body)}</p>` : ''}
        ${
          actionLabel
            ? `<button type="button" class="btn btn-primary mt12" id="${id}">${escape(actionLabel)}</button>`
            : ''
        }
      </div>
    `;
    if (actionLabel && onAction) {
      // Caller is responsible for inserting `html` into DOM, then calling
      // emptyState.bind(id, onAction). Returning a string keeps the API simple.
      queueMicrotask(() => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', onAction, { once: true });
      });
    }
    return html;
  }

  /* ---------------- Friendly errors ---------------- */

  const ERR_MAP = {
    UNAUTHORIZED: 'Sessie verlopen, log opnieuw in.',
    FORBIDDEN: 'Geen toegang voor deze actie.',
    NOT_FOUND: 'Niet gevonden.',
    VALIDATION_ERROR: 'Controleer de ingevulde velden.',
    RATE_LIMITED: 'Even rustig — te veel verzoeken in korte tijd.',
    NETWORK_ERROR: 'Geen verbinding met de server. Probeer het opnieuw.',
    CONFLICT: 'Deze klus is net door iemand anders opgepakt.',
    ALREADY_REVIEWED: 'Je hebt deze klus al beoordeeld.',
    INVALID_TRANSITION: 'Deze actie kan niet meer in de huidige status.',
  };

  function friendlyError(err) {
    if (!err) return 'Er is iets misgegaan.';
    const code = err.code || err.error || err.name;
    if (code && ERR_MAP[code]) return ERR_MAP[code];
    if (err.status === 0 || /network/i.test(err.message || '')) return ERR_MAP.NETWORK_ERROR;
    if (err.status === 401) return ERR_MAP.UNAUTHORIZED;
    if (err.status === 403) return ERR_MAP.FORBIDDEN;
    if (err.status === 404) return ERR_MAP.NOT_FOUND;
    if (err.status === 409) return ERR_MAP.CONFLICT;
    if (err.status === 429) return ERR_MAP.RATE_LIMITED;
    return err.message || 'Er is iets misgegaan.';
  }

  /* ---------------- Submit lock ---------------- */

  async function submitLock(button, fn) {
    if (!button) return fn();
    if (button.disabled) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escape(button.textContent.trim() || 'Bezig…')}</span>`;
    try {
      return await fn();
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = original;
    }
  }

  /* ---------------- Confirm modal (native <dialog>) ---------------- */

  function ensureDialog() {
    let dlg = document.getElementById('confirm-dialog');
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'confirm-dialog';
    dlg.className = 'kr-dialog';
    dlg.setAttribute('aria-labelledby', 'confirm-title');
    dlg.setAttribute('aria-describedby', 'confirm-message');
    dlg.innerHTML = `
      <form method="dialog" class="kr-dialog__inner">
        <h2 id="confirm-title" class="h3"></h2>
        <p id="confirm-message" class="sm mt8"></p>
        <div class="flex jb g10 mt16">
          <button type="button" value="cancel" class="btn btn-secondary" data-confirm-cancel>Annuleren</button>
          <button type="submit" value="confirm" class="btn btn-primary" data-confirm-ok>OK</button>
        </div>
      </form>
    `;
    document.body.appendChild(dlg);
    return dlg;
  }

  function confirmDialog({ title = 'Weet je het zeker?', message = '', confirmLabel = 'Bevestig', cancelLabel = 'Annuleren', danger = false } = {}) {
    return new Promise((resolve) => {
      const dlg = ensureDialog();
      dlg.querySelector('#confirm-title').textContent = title;
      dlg.querySelector('#confirm-message').textContent = message;
      const okBtn = dlg.querySelector('[data-confirm-ok]');
      const cancelBtn = dlg.querySelector('[data-confirm-cancel]');
      okBtn.textContent = confirmLabel;
      cancelBtn.textContent = cancelLabel;
      okBtn.classList.toggle('btn-danger', !!danger);
      okBtn.classList.toggle('btn-primary', !danger);

      const opener = document.activeElement;
      const onClose = () => {
        const value = dlg.returnValue;
        dlg.removeEventListener('close', onClose);
        if (opener && typeof opener.focus === 'function') opener.focus();
        resolve(value === 'confirm');
      };
      const onCancel = (e) => {
        e.preventDefault();
        dlg.returnValue = 'cancel';
        dlg.close('cancel');
      };

      dlg.addEventListener('close', onClose);
      cancelBtn.onclick = onCancel;

      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', ''); // very old browser fallback
      okBtn.focus();
    });
  }

  /* ---------------- Form validation ---------------- */

  function validate(form, rules) {
    let valid = true;
    for (const name of Object.keys(rules)) {
      const input = form.elements[name];
      if (!input) continue;
      const value = input.value == null ? '' : String(input.value).trim();
      const rule = rules[name];
      let error = null;
      if (rule.required && !value) error = rule.message || 'Verplicht veld.';
      if (!error && rule.minLength && value.length < rule.minLength)
        error = rule.message || `Minimaal ${rule.minLength} tekens.`;
      if (!error && rule.maxLength && value.length > rule.maxLength)
        error = rule.message || `Maximaal ${rule.maxLength} tekens.`;
      if (!error && rule.pattern && value && !rule.pattern.test(value))
        error = rule.message || 'Ongeldige waarde.';
      if (!error && rule.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
        error = rule.message || 'Geen geldig e-mailadres.';
      if (!error && rule.min != null && value !== '' && Number(value) < rule.min)
        error = rule.message || `Moet minimaal ${rule.min} zijn.`;
      if (!error && rule.max != null && value !== '' && Number(value) > rule.max)
        error = rule.message || `Mag maximaal ${rule.max} zijn.`;

      setFieldError(input, error);
      if (error) valid = false;
    }
    return valid;
  }

  function setFieldError(input, error) {
    const errId = (input.id || input.name) + '-err';
    let errEl = document.getElementById(errId);
    if (error) {
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = errId;
        errEl.className = 'field-error';
        errEl.setAttribute('role', 'alert');
        const wrap = input.closest('.fg, .pw-w') || input.parentElement;
        wrap.appendChild(errEl);
      }
      errEl.textContent = error;
      input.setAttribute('aria-invalid', 'true');
      const prev = input.getAttribute('aria-describedby') || '';
      if (!prev.split(' ').includes(errId))
        input.setAttribute('aria-describedby', (prev + ' ' + errId).trim());
    } else if (errEl) {
      errEl.remove();
      input.removeAttribute('aria-invalid');
      const prev = input.getAttribute('aria-describedby') || '';
      const next = prev.split(' ').filter((x) => x && x !== errId).join(' ');
      if (next) input.setAttribute('aria-describedby', next);
      else input.removeAttribute('aria-describedby');
    }
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.field-error').forEach((n) => n.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((n) => n.removeAttribute('aria-invalid'));
  }

  /* ---------------- Focus / a11y helpers ---------------- */

  function focusFirstHeading(root) {
    const h =
      root.querySelector('[data-focus-on-enter]') ||
      root.querySelector('h1, h2');
    if (!h) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }

  function announceRoute(text) {
    const el = document.getElementById('route-live');
    if (!el || !text) return;
    el.textContent = '';
    // requestAnimationFrame ensures SR re-reads the live region.
    requestAnimationFrame(() => {
      el.textContent = text;
    });
  }

  function bindRovingTabindex(container, itemSelector) {
    if (!container) return;
    const items = () => Array.from(container.querySelectorAll(itemSelector));
    const setActive = (idx) => {
      const list = items();
      list.forEach((it, i) => it.setAttribute('tabindex', i === idx ? '0' : '-1'));
      list[idx]?.focus();
    };
    const initial = items();
    if (initial.length === 0) return;
    initial.forEach((it, i) => it.setAttribute('tabindex', i === 0 ? '0' : '-1'));
    container.addEventListener('keydown', (e) => {
      const list = items();
      const idx = list.indexOf(document.activeElement);
      if (idx === -1) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((idx + 1) % list.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((idx - 1 + list.length) % list.length);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActive(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActive(list.length - 1);
      }
    });
  }

  /* ---------------- Counter animation ---------------- */

  function animateCounters() {
    const targets = document.querySelectorAll('[data-counter]');
    if (targets.length === 0) return;
    const reduced = prefersReducedMotion();
    const fmt = (n, suffix) => {
      if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' + suffix;
      return n.toLocaleString('nl-NL') + suffix;
    };
    const tween = (el) => {
      const target = Number(el.dataset.counter);
      const suffix = el.dataset.suffix || '';
      if (Number.isNaN(target)) return;
      if (reduced) {
        el.textContent = fmt(target, suffix);
        return;
      }
      const duration = 1100;
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        const current = Math.floor(target * eased);
        el.textContent = fmt(current, suffix);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) {
      targets.forEach(tween);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tween(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    targets.forEach((t) => io.observe(t));
  }

  /* ---------------- Theme ---------------- */

  function initTheme() {
    const stored = localStorage.getItem('klusraak.theme');
    let theme = stored;
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    setTheme(theme, false);
  }

  function setTheme(theme, persist = true) {
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) localStorage.setItem('klusraak.theme', theme);
    document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      btn.setAttribute(
        'aria-label',
        theme === 'light' ? 'Wissel naar donker thema' : 'Wissel naar licht thema',
      );
      // Replace the icon: native <i data-lucide=...> first, then any
      // already-rendered <svg> with class lucide- so we cover both states.
      const lucideName = theme === 'light' ? 'sun' : 'moon';
      let icon = btn.querySelector('[data-lucide]');
      if (icon) {
        icon.setAttribute('data-lucide', lucideName);
      } else {
        // Lucide already swapped <i> for <svg>; replace the svg with a fresh <i>.
        const svg = btn.querySelector('svg');
        if (svg) {
          const i = document.createElement('i');
          i.setAttribute('data-lucide', lucideName);
          svg.replaceWith(i);
        }
      }
    });
    refreshIcons();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'light' ? 'dark' : 'light', true);
  }

  // Apply stored/preferred theme as early as possible to avoid FOUC.
  initTheme();

  /* ---------------- Job card (button, a11y) ---------------- */

  // Deterministic pseudo-random helpers — same job id always shows the
  // same fake "verified" / "urgent" / "response-time" tags.
  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function jobBadges(job) {
    const h = hashCode(String(job.id || job.title || ''));
    const tags = [];
    if (h % 5 < 3) tags.push('<span class="verified">Geverifieerd</span>');
    if (h % 7 === 0) tags.push('<span class="top-rated">Top rated</span>');
    if (h % 4 === 1) tags.push('<span class="urgency">Spoed</span>');
    return tags.join(' ');
  }
  function jobResponseLine(job) {
    const h = hashCode(String(job.id || job.title || ''));
    const mins = 8 + (h % 24); // 8 - 31 min
    return `<span class="response-line">Reageert meestal binnen <strong>${mins} min</strong></span>`;
  }

  function jobCard(job) {
    const status = STATUS_LABELS[job.status] || job.status;
    const cls = STATUS_BADGE[job.status] || 'bx';
    const desc = job.description || '';
    const isOpen = job.status === 'OPEN';
    return `
      <button type="button" class="kc card-hover" data-job-id="${escape(job.id)}" aria-label="Klus: ${escape(job.title)}, ${escape(status)}">
        <span class="kch flex jb ac g8">
          <span class="badge ${cls}">${escape(status)}</span>
          <span class="xs">${escape(fmtDate(job.createdAt))}</span>
        </span>
        <span class="kcb">
          <span class="h4 kc__title">${escape(job.title)}</span>
          <span class="sm mt4 kc__meta">${escape(job.category?.name || '')} · ${escape(job.city)}</span>
          <span class="flex ac g8 mt8" style="flex-wrap:wrap;">${jobBadges(job)}</span>
          <span class="sm mt8 kc__desc">${escape(desc.slice(0, 110))}${desc.length > 110 ? '…' : ''}</span>
          ${isOpen ? `<span class="mt8" style="display:block;">${jobResponseLine(job)}</span>` : ''}
        </span>
        <span class="kcf">
          <span class="xs">${escape(fmtMoney(job.budgetCents))}</span>
          <span class="kc__cta" aria-hidden="true">${isOpen ? 'Reageer →' : 'Bekijk →'}</span>
        </span>
      </button>
    `;
  }

  /* ---------------- Exports ---------------- */

  KR.utils = {
    escape, fmtMoney, fmtDate, initials, prefersReducedMotion,
    toast, hideSnack,
    skeletonList, emptyState,
    friendlyError,
    submitLock,
    confirm: confirmDialog,
    focusFirstHeading, announceRoute, bindRovingTabindex,
    animateCounters,
    setTheme, toggleTheme,
    refreshIcons,
    jobCard,
    STATUS_LABELS, STATUS_BADGE,
  };
  KR.forms = { validate, setFieldError, clearFieldErrors };

  // Back-compat global
  window.toast = toast;
})();
