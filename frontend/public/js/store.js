// Tiny in-memory + localStorage state. We persist tokens (so a refresh keeps
// the session) and the cached profile.
(function () {
  const KEY = 'klusraak.session.v1';

  const Store = {
    accessToken: null,
    refreshToken: null,
    user: null,
    categories: [],
    currentJobId: null,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        this.accessToken = parsed.accessToken || null;
        this.refreshToken = parsed.refreshToken || null;
        this.user = parsed.user || null;
      } catch (_) { /* ignore corrupt storage */ }
    },

    persist() {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          user: this.user,
        }),
      );
    },

    setSession({ accessToken, refreshToken, user }) {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      if (user) this.user = user;
      this.persist();
    },

    setUser(user) {
      this.user = user;
      this.persist();
    },

    clear() {
      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      localStorage.removeItem(KEY);
    },

    isAuthed() {
      return !!this.accessToken && !!this.user;
    },

    isClient() {
      return this.user?.role === 'CLIENT';
    },

    isCraftsman() {
      return this.user?.role === 'CRAFTSMAN';
    },
  };

  Store.load();
  const KR = (window.KR = window.KR || {});
  KR.Store = Store;
  // Back-compat: existing call sites use `window.Store`.
  window.Store = Store;
})();
