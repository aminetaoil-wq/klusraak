// Build-time configuration. Netlify replaces this file via
// scripts/inject-api-base.sh using the KLUSRAAK_API_BASE environment
// variable. Locally this default is used.
window.KLUSRAAK_API_BASE = window.KLUSRAAK_API_BASE || 'http://localhost:4000';
