/**
 * LifeFlow State Manager
 *
 * Release 1 / Task 1: centralized workspace-state persistence and subscriptions.
 * Keep account-scoped keys and the legacy migration key compatible with v2.
 *
 * This module is intentionally not wired into script.js yet. The next migration
 * step can adopt it incrementally without changing the current boot/auth flow.
 */

export const LEGACY_STATE_KEY = 'lifeflow2_state';
export const STATE_KEY_PREFIX = 'lifeflow2_state_';
export const DEFAULT_SAVE_DELAY = 300;

export function defaultProfileState(email) {
  return { tasks: [], currentUser: email || null };
}

export function profileStateKey(email) {
  return STATE_KEY_PREFIX + encodeURIComponent(String(email || ''));
}

function clone(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) { /* JSON-compatible fallback */ }
  }
  return JSON.parse(JSON.stringify(value));
}

function equal(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  try { return JSON.stringify(a) === JSON.stringify(b); }
  catch (_) { return false; }
}

function readJSON(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export class StateManager {
  #state;
  #storage;
  #listeners = new Map();
  #saveTimer = null;
  #saveDelay;
  #onStorage;
  #onPageHide;

  constructor({
    currentUser = null,
    defaults = defaultProfileState,
    storage = globalThis.localStorage,
    saveDelay = DEFAULT_SAVE_DELAY,
    listenToBrowserEvents = true
  } = {}) {
    if (!storage) throw new Error('StateManager requires a Storage-compatible adapter.');

    this.#storage = storage;
    this.#saveDelay = Math.max(0, Number(saveDelay) || 0);
    this.defaults = defaults;

    this.#state = this.#loadForUser(currentUser);

    this.#onStorage = event => {
      if (event.key !== this.#storageKey()) return;
      const next = this.#loadForUser(this.#state.currentUser);
      this.#replaceFromExternal(next);
    };
    this.#onPageHide = () => this.flush();

    if (listenToBrowserEvents && typeof window !== 'undefined') {
      window.addEventListener('storage', this.#onStorage);
      window.addEventListener('pagehide', this.#onPageHide);
    }
  }

  #storageKey() {
    return this.#state?.currentUser ? profileStateKey(this.#state.currentUser) : null;
  }

  #loadForUser(email) {
    const base = this.defaults(email);
    if (!email) return base;

    const accountState = readJSON(this.#storage, profileStateKey(email));
    if (accountState && typeof accountState === 'object' && !Array.isArray(accountState)) {
      return { ...base, ...accountState, currentUser: email };
    }

    const legacy = readJSON(this.#storage, LEGACY_STATE_KEY);
    if (legacy && legacy.currentUser === email) {
      const migrated = { ...base, ...legacy, currentUser: email };
      // Preserve the old migration behaviour: copy the legacy profile into
      // its account-scoped key. The debounced writer handles future changes.
      try { this.#storage.setItem(profileStateKey(email), JSON.stringify(migrated)); }
      catch (_) { /* Storage may be full or unavailable; keep the in-memory state. */ }
      return migrated;
    }

    return base;
  }

  getState() {
    return clone(this.#state);
  }

  setState(update) {
    const previous = this.#state;
    const draft = clone(previous);
    const patch = typeof update === 'function' ? update(draft) : update;

    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      throw new TypeError('StateManager.setState expects a partial object or an updater returning one.');
    }

    const next = { ...previous, ...clone(patch) };
    const changedKeys = new Set([
      ...Object.keys(previous),
      ...Object.keys(next)
    ]);

    this.#state = next;

    for (const key of changedKeys) {
      if (equal(previous[key], next[key])) continue;
      this.#notify(key, next[key], previous[key]);
    }

    if ([...changedKeys].some(key => !equal(previous[key], next[key]))) {
      this.#scheduleSave();
    }

    return this.getState();
  }

  subscribe(key, callback) {
    if (typeof key !== 'string' || !key) {
      throw new TypeError('StateManager.subscribe requires a state key.');
    }
    if (typeof callback !== 'function') {
      throw new TypeError('StateManager.subscribe requires a callback function.');
    }

    if (!this.#listeners.has(key)) this.#listeners.set(key, new Set());
    this.#listeners.get(key).add(callback);

    return () => this.unsubscribe(callback);
  }

  unsubscribe(callback) {
    if (typeof callback !== 'function') return;
    for (const [key, listeners] of this.#listeners) {
      listeners.delete(callback);
      if (!listeners.size) this.#listeners.delete(key);
    }
  }

  #notify(key, value, previousValue) {
    const listeners = this.#listeners.get(key);
    if (!listeners) return;

    for (const callback of [...listeners]) {
      try {
        callback(clone(value), clone(previousValue), this.getState());
      } catch (error) {
        // One subscriber must not prevent other subscribers from updating.
        queueMicrotask(() => { throw error; });
      }
    }
  }

  #replaceFromExternal(next) {
    const previous = this.#state;
    this.#state = next;
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    for (const key of keys) {
      if (!equal(previous[key], next[key])) this.#notify(key, next[key], previous[key]);
    }
  }

  #scheduleSave() {
    if (!this.#storageKey()) return;
    if (this.#saveTimer !== null) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      this.flush();
    }, this.#saveDelay);
  }

  flush() {
    if (this.#saveTimer !== null) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }

    const key = this.#storageKey();
    if (!key) return false;

    try {
      this.#storage.setItem(key, JSON.stringify(this.#state));
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Switch the active account without carrying the previous account's data
   * into the next profile. Auth integration should call this on login/logout.
   */
  switchUser(email) {
    if (this.#saveTimer !== null) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.#state = this.#loadForUser(email || null);
    this.#replaceFromExternal(this.#state);
    return this.getState();
  }

  destroy() {
    this.flush();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.#onStorage);
      window.removeEventListener('pagehide', this.#onPageHide);
    }
    this.#listeners.clear();
  }
}

export default StateManager;
