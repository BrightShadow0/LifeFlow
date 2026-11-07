/**
 * LifeFlow State Manager
 *
 * Centralized account-scoped workspace-state persistence and subscriptions.
 * Keep account-scoped keys and the legacy migration key compatible with v2.
 *
 * Theme, task and notes controllers use this manager as their shared workspace
 * state boundary. Profile preferences use its adapter hooks while retaining
 * the existing lifeflow2_users storage contract.
 */

export const LEGACY_STATE_KEY = 'lifeflow2_state';
export const STATE_KEY_PREFIX = 'lifeflow2_state_';
export const DEFAULT_SAVE_DELAY = 300;

export function defaultProfileState(email) {
  return { tasks: [], notes: [], codeNotes: [], noteLinks: [], folders: [{ id: 'folder-work', name: 'Work', icon: '💼', color: '#55ddeb', isDefault: true }, { id: 'folder-personal', name: 'Personal', icon: '◉', color: '#a78bfa', isDefault: true }, { id: 'folder-projects', name: 'Projects', icon: '▣', color: '#f5b942', isDefault: true }, { id: 'folder-archive', name: 'Archive', icon: '▤', color: '#94a3b8', isDefault: true }, { id: 'unfiled', name: 'Unfiled', icon: '▤', color: '#94a3b8', isDefault: true }], searchQuery: '', collapsedFolders: [], currentUser: email || null };
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
  #keyForUser;
  #loadStateAdapter;
  #saveStateAdapter;

  constructor({
    currentUser = null,
    defaults = defaultProfileState,
    storage = globalThis.localStorage,
    saveDelay = DEFAULT_SAVE_DELAY,
    listenToBrowserEvents = true,
    keyForUser = profileStateKey,
    loadState = null,
    saveState = null
  } = {}) {
    if (!storage) throw new Error('StateManager requires a Storage-compatible adapter.');

    this.#storage = storage;
    this.#saveDelay = Math.max(0, Number(saveDelay) || 0);
    this.defaults = defaults;
    this.#keyForUser = typeof keyForUser === 'function' ? keyForUser : () => keyForUser;
    this.#loadStateAdapter = typeof loadState === 'function' ? loadState : null;
    this.#saveStateAdapter = typeof saveState === 'function' ? saveState : null;

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
    return this.#state?.currentUser ? this.#keyForUser(this.#state.currentUser) : null;
  }

  #loadForUser(email) {
    const base = this.defaults(email);
    if (!email) return base;

    if (this.#loadStateAdapter) {
      try {
        const adapted = this.#loadStateAdapter(email, { storage: this.#storage, defaults: clone(base) });
        if (adapted && typeof adapted === 'object' && !Array.isArray(adapted)) {
          return { ...base, ...clone(adapted), currentUser: email };
        }
      } catch (_) {
        // Keep the application bootable if an optional slice adapter fails.
      }
      return base;
    }

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

  replaceState(nextState) {
    if (!nextState || typeof nextState !== 'object' || Array.isArray(nextState)) throw new TypeError('StateManager.replaceState expects a state object.');
    const next={...clone(nextState),currentUser:this.#state.currentUser};
    this.#replaceFromExternal(next);this.#scheduleSave();return this.getState();
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
      if (this.#saveStateAdapter) {
        return this.#saveStateAdapter(clone(this.#state), this.#state.currentUser, this.#storage) !== false;
      }
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
    this.flush();
    const next = this.#loadForUser(email || null);
    this.#replaceFromExternal(next);
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


const ARCHIVE_PROFILE_FIELDS = ['name','bio','avatar','timezone','language','weekStart','workspace'];
const ARCHIVE_PREFERENCE_FIELDS = ['theme','autoTheme','colorTheme','ambient','workspaceBackdrop','translucentSidebar','interactiveAtmosphere'];
function archivePick(source, fields) {
  const result = {};
  if (!source || typeof source !== 'object') return result;
  for (const key of fields) if (Object.prototype.hasOwnProperty.call(source, key)) result[key] = clone(source[key]);
  return result;
}
function archiveStripSecrets(value) {
  if (Array.isArray(value)) return value.map(archiveStripSecrets);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, entry] of Object.entries(value)) {
    if (/^(sessionToken|accessToken|refreshToken|bearerToken|token|passwordHash|password|secret|authorization)$/i.test(key)) continue;
    clean[key] = archiveStripSecrets(entry);
  }
  return clean;
}
export function exportMasterArchive(encrypted = false, options = {}) {
  if (encrypted) throw new Error('Encrypted archives are not available yet. Export an unencrypted JSON archive.');
  const { workspaceState = {}, profile = {}, appVersion = '1.0.0', now = new Date() } = options;
  const safeState = archiveStripSecrets(workspaceState || {});
  const archive = {
    metadata: { version:'1.1', timestamp:now.toISOString(), appVersion:String(appVersion || '1.0.0') },
    data: {
      profile: archivePick(profile, ARCHIVE_PROFILE_FIELDS),
      preferences: archivePick(profile, ARCHIVE_PREFERENCE_FIELDS),
      folders: clone(safeState.folders || []),
      notes: { regular:clone(safeState.notes || []), code:clone(safeState.codeNotes || []) },
      tasks:clone(safeState.tasks || []), noteLinks:clone(safeState.noteLinks || []), state:safeState
    }
  };
  const json = JSON.stringify(archive, null, 2);
  if (/"(?:sessionToken|accessToken|refreshToken|bearerToken|token|passwordHash|password|secret|authorization)"\\s*:/i.test(json)) {
    throw new Error('Archive security validation failed.');
  }
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = now.toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = 'lifeflow_archive_' + date + '.json';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { archive, filename: anchor.download };
}

function archiveObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
export function validateMasterArchive(archive){
 const errors=[],warnings=[];
 if(!archiveObject(archive))return {valid:false,errors:['The file must contain a JSON object.'],warnings,migrationRequired:false};
 if(!archiveObject(archive.metadata))errors.push('Missing metadata block.');
 if(!archiveObject(archive.data))errors.push('Missing data block.');
 if(errors.length)return {valid:false,errors,warnings,migrationRequired:false};
 const m=archive.metadata,d=archive.data;
 if(typeof m.version!=='string'||!m.version.trim())errors.push('Missing archive version.');
 if(!m.timestamp||Number.isNaN(Date.parse(m.timestamp)))errors.push('Invalid archive timestamp.');
 const legacy=m.version==='1.0'&&Array.isArray(archive.tasks)&&archiveObject(archive.notes);
 const migrationRequired=m.version!=='1.1'&&!legacy;
 if(migrationRequired)errors.push('This archive version is not supported by this LifeFlow version.');
 const p=legacy?archive:d,n=p.notes;
 if(!Array.isArray(p.tasks))errors.push('Tasks must be an array.');
 if(!archiveObject(n)||!Array.isArray(n.regular)||!Array.isArray(n.code))errors.push('Notes must contain regular and code arrays.');
 if(!Array.isArray(p.folders)||!Array.isArray(p.noteLinks))errors.push('Folders and note links must be arrays.');
 if(Array.isArray(p.tasks))p.tasks.forEach((t,i)=>{if(!archiveObject(t)||t.id==null||!String(t.id).trim()||typeof t.title!=='string'||!t.title.trim())errors.push('Task '+(i+1)+' is missing an essential id or title.');});
 if(archiveObject(n))['regular','code'].forEach(k=>Array.isArray(n[k])&&n[k].forEach((x,i)=>{if(!archiveObject(x)||x.id==null||!String(x.id).trim()||typeof x.title!=='string'||!x.title.trim())errors.push('Note '+(i+1)+' is missing an essential id or title.');}));
 if(legacy)warnings.push('Legacy archive format detected. It will be normalized during restore.');
 return {valid:errors.length===0,errors,warnings,migrationRequired};
}
export function normalizeMasterArchive(a){
 const v=validateMasterArchive(a);if(!v.valid)throw new Error(v.errors.join(' '));
 if(a.metadata.version==='1.0')return {metadata:{...a.metadata,version:'1.1'},data:{profile:a.profile||{},preferences:a.preferences||{},folders:a.folders||[],notes:a.notes,tasks:a.tasks,noteLinks:a.noteLinks||[],state:{...(a.state||{}),tasks:a.tasks,notes:a.notes.regular,codeNotes:a.notes.code,folders:a.folders||[],noteLinks:a.noteLinks||[]}}};
 return a;
}

export default StateManager;
