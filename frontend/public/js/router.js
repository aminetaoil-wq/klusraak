// Minimal screen router. Each screen is a <section class="sc"> with a unique id.
// Handles auth gating, focus management, aria-current sync and SR
// announcements via the global #route-live live region.
(function () {
  const PUBLIC_SCREENS = new Set(['sc-home', 'sc-auth', 'sc-services']);

  const SCREEN_LABELS = {
    'sc-home': 'Home',
    'sc-services': 'Alle diensten',
    'sc-auth': 'Inloggen of registreren',
    'sc-dash': 'Dashboard',
    'sc-jobs': 'Klussen',
    'sc-new': 'Nieuwe klus',
    'sc-job': 'Klus details',
    'sc-chat': 'Chat',
    'sc-profile': 'Profiel',
  };

  function syncBottomNavCurrent(currentId) {
    document.querySelectorAll('.bnav').forEach((nav) => {
      nav.querySelectorAll('.bni').forEach((btn) => {
        const target = btn.dataset.go;
        if (target === currentId) {
          btn.setAttribute('aria-current', 'page');
          btn.classList.add('on');
        } else {
          btn.removeAttribute('aria-current');
          btn.classList.remove('on');
        }
      });
    });
    document.querySelectorAll('.app-header .nav-link').forEach((link) => {
      const target = link.dataset.go;
      if (target === currentId) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  const Router = {
    current: 'sc-home',

    go(id, payload) {
      const auth = window.Store?.isAuthed();
      if (!auth && !PUBLIC_SCREENS.has(id)) {
        id = 'sc-auth';
      }

      document.querySelectorAll('.sc').forEach((sc) => sc.classList.remove('on'));
      const target = document.getElementById(id);
      if (!target) return;
      target.classList.add('on');
      this.current = id;
      window.scrollTo({ top: 0, behavior: 'instant' });
      syncBottomNavCurrent(id);

      // Notify screen handlers (re-fetch data).
      window.dispatchEvent(new CustomEvent('screen:enter', { detail: { id, payload } }));

      // Move focus to the screen heading, announce route to SR, refresh
      // any Lucide icons that may have been added since last render.
      const utils = window.KR?.utils;
      if (utils) {
        requestAnimationFrame(() => {
          utils.focusFirstHeading(target);
          utils.announceRoute(SCREEN_LABELS[id] || id);
          utils.refreshIcons?.();
        });
      }
    },
  };

  const KR = (window.KR = window.KR || {});
  KR.Router = Router;
  window.Router = Router;
})();
