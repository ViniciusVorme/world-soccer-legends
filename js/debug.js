/**
 * Logs de desenvolvimento — silenciados em produção.
 * Ative com `?debug=1` na URL ou `localStorage.setItem('presidente-fc-debug', '1')`.
 */
function isDebugEnabled() {
  try {
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
      return true;
    }
    if (typeof localStorage !== 'undefined' && localStorage.getItem('presidente-fc-debug') === '1') {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export const DEBUG = isDebugEnabled();

export function devWarn(...args) {
  if (DEBUG) console.warn(...args);
}

export function devLog(...args) {
  if (DEBUG) console.log(...args);
}
