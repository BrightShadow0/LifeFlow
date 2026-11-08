/* LifeFlow Release 6 · Local Recovery Vault
 * Stores rolling, account-scoped recovery points in IndexedDB.
 * This is a same-device recovery layer, not a cloud backup.
 */
(function (global) {
  'use strict';

  const DB_NAME = 'lifeflow-recovery-v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'snapshots';
  const MAX_SNAPSHOTS_PER_USER = 12;
  const AUTO_SNAPSHOT_INTERVAL = 2 * 60 * 1000;
  const RECOVERY_SCHEMA_VERSION = 1;
  const lastCaptureAt = new Map();
  const pendingCaptures = new Map();
  let dbPromise = null;

  const status = {
    available: typeof indexedDB !== 'undefined',
    ready: false,
    persisted: null,
    lastSavedAt: null,
    error: null
  };

  function clone(value) {
    if (value === undefined || value === null || typeof value !== 'object') return value;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) { /* JSON fallback */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function sanitise(value) {
    if (Array.isArray(value)) return value.map(sanitise);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (/^(sessionToken|accessToken|refreshToken|bearerToken|token|passwordHash|password|secret|authorization)$/i.test(key)) return;
      result[key] = sanitise(entry);
    });
    return result;
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;
    if (!status.available) return Promise.reject(new Error('IndexedDB is not available in this browser.'));
    dbPromise = new Promise((resolve, reject) => {
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-user', 'user', { unique: false });
          store.createIndex('by-created', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('Could not open the recovery database.'));
      request.onblocked = () => reject(new Error('The recovery database is busy in another LifeFlow tab. Close duplicate tabs and retry.'));
    });
    dbPromise.catch(error => { status.error = error.message || 'Recovery storage unavailable.'; dbPromise = null; });
    return dbPromise;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Recovery storage request failed.'));
    });
  }

  async function initialise() {
    try {
      await openDatabase();
      status.ready = true;
      status.available = true;
      status.error = null;
      if (navigator.storage && typeof navigator.storage.persisted === 'function') {
        try { status.persisted = await navigator.storage.persisted(); } catch (_) { status.persisted = null; }
      }
      return getStatus();
    } catch (error) {
      status.ready = false;
      status.error = error.message || 'Recovery storage could not be opened.';
      return getStatus();
    }
  }

  function getStatus() {
    return { ...status };
  }

  async function requestPersistentStorage() {
    if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
      return { supported: false, persisted: false, message: 'This browser does not offer persistent storage controls.' };
    }
    try {
      status.persisted = await navigator.storage.persist();
      return {
        supported: true,
        persisted: status.persisted,
        message: status.persisted
          ? 'The browser granted persistent storage for LifeFlow.'
          : 'The browser did not grant persistent storage. Your data still works, but browser eviction protection is not enabled.'
      };
    } catch (error) {
      return { supported: true, persisted: false, message: error.message || 'The browser could not change storage protection.' };
    }
  }

  async function prune(user) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.index('by-user').getAll(user);
      request.onsuccess = () => {
        const rows = (request.result || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        rows.slice(MAX_SNAPSHOTS_PER_USER).forEach(row => store.delete(row.id));
      };
      request.onerror = () => reject(request.error || new Error('Could not review recovery history.'));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not maintain recovery history.'));
      tx.onabort = () => reject(tx.error || new Error('Recovery history maintenance was cancelled.'));
    });
  }

  async function capture(options) {
    const args = options || {};
    const user = String(args.user || '').trim().toLowerCase();
    const workspace = args.state;
    const source = String(args.source || 'automatic');
    const force = args.force === true;
    if (!user) return { saved: false, reason: 'no-user' };
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace)) {
      return { saved: false, reason: 'invalid-state' };
    }

    const now = Date.now();
    if (!force && now - (lastCaptureAt.get(user) || 0) < AUTO_SNAPSHOT_INTERVAL) {
      return { saved: false, skipped: true, reason: 'recent-snapshot' };
    }
    if (pendingCaptures.has(user)) return pendingCaptures.get(user);

    const task = (async () => {
      try {
        const db = await openDatabase();
        const payload = sanitise(clone(workspace));
        const record = {
          id: encodeURIComponent(user) + ':' + now + ':' + Math.random().toString(36).slice(2, 9),
          user,
          createdAt: new Date(now).toISOString(),
          source,
          schemaVersion: RECOVERY_SCHEMA_VERSION,
          appVersion: 'release-6',
          payload
        };
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(record);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error || new Error('Could not save a recovery point.'));
          tx.onabort = () => reject(tx.error || new Error('Saving a recovery point was cancelled.'));
        });
        lastCaptureAt.set(user, now);
        status.lastSavedAt = record.createdAt;
        status.error = null;
        await prune(user);
        global.dispatchEvent(new CustomEvent('lifeflow:recovery-updated', { detail: { user, createdAt: record.createdAt } }));
        return { saved: true, id: record.id, createdAt: record.createdAt };
      } catch (error) {
        status.error = error.message || 'Recovery point could not be saved.';
        return { saved: false, reason: 'storage-error', message: status.error };
      } finally {
        pendingCaptures.delete(user);
      }
    })();
    pendingCaptures.set(user, task);
    return task;
  }

  async function list(user) {
    const account = String(user || '').trim().toLowerCase();
    if (!account) return [];
    const db = await openDatabase();
    const rows = await requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('by-user').getAll(account));
    return (rows || []).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(row => {
      const payload = row.payload || {};
      return {
        id: row.id,
        createdAt: row.createdAt,
        source: row.source || 'automatic',
        schemaVersion: row.schemaVersion || 1,
        taskCount: Array.isArray(payload.tasks) ? payload.tasks.length : 0,
        noteCount: (Array.isArray(payload.notes) ? payload.notes.length : 0) + (Array.isArray(payload.codeNotes) ? payload.codeNotes.length : 0),
        folderCount: Array.isArray(payload.folders) ? payload.folders.length : 0
      };
    });
  }

  async function get(user, id) {
    const account = String(user || '').trim().toLowerCase();
    if (!account || !id) return null;
    const db = await openDatabase();
    const record = await requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(String(id)));
    if (!record || record.user !== account) return null;
    return clone(record);
  }

  async function summary(user) {
    try {
      const rows = await list(user);
      return {
        available: true,
        count: rows.length,
        latest: rows[0] || null,
        oldest: rows.length ? rows[rows.length - 1] : null,
        persisted: status.persisted,
        error: status.error
      };
    } catch (error) {
      return { available: false, count: 0, latest: null, oldest: null, persisted: status.persisted, error: error.message || status.error };
    }
  }

  async function clearUser(user) {
    const account = String(user || '').trim().toLowerCase();
    if (!account) return;
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.index('by-user').getAllKeys(account);
      request.onsuccess = () => (request.result || []).forEach(id => store.delete(id));
      request.onerror = () => reject(request.error || new Error('Could not locate this account’s recovery points.'));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not delete this account’s recovery points.'));
      tx.onabort = () => reject(tx.error || new Error('Deleting this account’s recovery points was cancelled.'));
    });
    lastCaptureAt.delete(account);
  }

  async function clearAll() {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Could not clear recovery points.'));
      tx.onabort = () => reject(tx.error || new Error('Clearing recovery points was cancelled.'));
    });
    lastCaptureAt.clear();
    status.lastSavedAt = null;
  }

  global.LifeFlowRecovery = Object.freeze({
    initialise,
    getStatus,
    requestPersistentStorage,
    capture,
    list,
    get,
    summary,
    clearUser,
    clearAll
  });
})(window);
