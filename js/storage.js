/**
 * Persistência local da carreira, do idioma e do escudo.
 * A API segue getItem / setItem / removeItem.
 */

const MEMORY = new Map();

export const STORAGE_KEYS = {
  SAVE: 'presidente-fc-save',
  LANG: 'presidente-fc-lang',
  CREST: 'presidente-fc-crest'
};

function readBrowserStorage(key) {
  if (typeof localStorage === 'undefined') {
    return MEMORY.has(key) ? MEMORY.get(key) : null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return MEMORY.has(key) ? MEMORY.get(key) : null;
  }
}

function writeBrowserStorage(key, value) {
  if (typeof localStorage === 'undefined') {
    MEMORY.set(key, value);
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    MEMORY.set(key, value);
  }
}

function removeBrowserStorage(key) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  MEMORY.delete(key);
}

export async function initPlayerStorage() {}

export function getItem(key) {
  return readBrowserStorage(key);
}

export function setItem(key, value) {
  writeBrowserStorage(key, String(value));
}

export function removeItem(key) {
  removeBrowserStorage(key);
}
