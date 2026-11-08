(function (global) {
  'use strict';

  const TABLE = 'encrypted_workspace_sync';
  const FORMAT = 'lifeflow-encrypted-workspace-sync';
  const VERSION = 1;
  const KDF_ITERATIONS = 600000;
  const MAX_BYTES = 25 * 1024 * 1024;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let user = null;
  let key = null;
  let salt = null;
  let revision = 0;
  let deviceId = null;
  let dirty = false;
  let timer = null;
  let onStatus = null;

  function client() {
    const api = global.LifeFlowSupabase;
    const instance = api && api.getClient && api.getClient();
    if (!instance) throw new Error('Supabase is unavailable. Check the connection and refresh.');
    return instance;
  }
  function randomBytes(length) { return crypto.getRandomValues(new Uint8Array(length)); }
  function toBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function fromBase64(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Sync encryption metadata is invalid.');
    const binary = atob(value);
    return Uint8Array.from(binary, ch => ch.charCodeAt(0));
  }
  function aad(userId, schema, rev) {
    return encoder.encode([FORMAT, VERSION, userId, String(schema), String(rev)].join('|'));
  }
  function validateWorkspace(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Workspace data is invalid.');
    const clean = { ...value };
    ['tasks', 'notes', 'codeNotes', 'folders', 'noteLinks'].forEach(name => {
      if (clean[name] === undefined) clean[name] = [];
      if (!Array.isArray(clean[name])) throw new Error('Workspace collection "' + name + '" is invalid.');
    });
    if (clean.currentUser && typeof clean.currentUser !== 'string') throw new Error('Workspace owner metadata is invalid.');
    clean.__lifeFlowSchemaVersion = Number(clean.__lifeFlowSchemaVersion) || 1;
    let serialized;
    try { serialized = JSON.stringify(clean); } catch (_) { throw new Error('Workspace contains data that cannot be synchronized.'); }
    if (typeof serialized !== 'string') throw new Error('Workspace is empty or invalid.');
    const bytes = encoder.encode(serialized);
    if (bytes.byteLength > MAX_BYTES) throw new Error('Workspace exceeds the 25 MiB cloud sync limit.');
    return { workspace: clean, serialized, bytes, schema: clean.__lifeFlowSchemaVersion };
  }
  async function deriveKey(passphrase, keySalt) {
    if (typeof passphrase !== 'string' || passphrase.length < 12 || passphrase.length > 1024 || !passphrase.trim()) {
      throw new Error('Your workspace sync passphrase must contain 12 to 1,024 characters.');
    }
    const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: keySalt, iterations: KDF_ITERATIONS, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }
  function openKeyStore() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) return reject(new Error('This browser does not support secure local key storage.'));
      const request = global.indexedDB.open('lifeflow-cloud-sync-keys', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('keys')) request.result.createObjectStore('keys', { keyPath: 'userId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open local sync key storage.'));
    });
  }
  async function storeDeviceKey(userId, keySalt, cryptoKey) {
    try {
      const db = await openKeyStore();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ userId, salt: toBase64(keySalt), key: cryptoKey, savedAt: Date.now() });
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
      db.close();
      return true;
    } catch (_) { return false; }
  }
  async function readDeviceKey(userId) {
    try {
      const db = await openKeyStore();
      const result = await new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readonly');
        const request = tx.objectStore('keys').get(userId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return result;
    } catch (_) { return null; }
  }
  async function forgetDeviceKey(userId) {
    try {
      const db = await openKeyStore();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').delete(userId);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
      db.close();
      return true;
    } catch (_) { return false; }
  }
  async function authenticatedUser() {
    const { data, error } = await client().auth.getUser();
    if (error || !data.user) throw new Error('Sign in to your cloud account before opening workspace sync.');
    const assurance = await client().auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw new Error('Could not verify cloud sign-in security level.');
    if (assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') {
      throw new Error('Complete authenticator verification before opening your cloud workspace.');
    }
    return data.user;
  }
  async function readRemote() {
    const { data, error } = await client().from(TABLE).select('*').eq('user_id', user.id).maybeSingle();
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') throw new Error('Cloud workspace sync is not installed yet. Apply the Release 11 SQL migration in your Supabase SQL Editor.');
      throw new Error(error.message || 'Could not read the encrypted cloud workspace.');
    }
    return data || null;
  }
  async function decryptRow(row) {
    if (!key || !salt) throw new Error('Unlock this cloud workspace with its sync passphrase.');
    if (row.encryption_version !== VERSION || row.kdf_iterations !== KDF_ITERATIONS) throw new Error('This cloud workspace uses an unsupported encryption version.');
    const remoteSalt = fromBase64(row.salt);
    if (toBase64(remoteSalt) !== toBase64(salt)) throw new Error('Cloud workspace encryption metadata does not match this device key.');
    const nonce = fromBase64(row.nonce), ciphertext = fromBase64(row.ciphertext);
    if (remoteSalt.length !== 16 || nonce.length !== 12 || ciphertext.length < 17 || ciphertext.length > MAX_BYTES + 16) throw new Error('Cloud workspace integrity metadata is invalid.');
    const schema = Number(row.schema_version), rev = Number(row.revision);
    if (!Number.isSafeInteger(schema) || schema < 1 || !Number.isSafeInteger(rev) || rev < 1) throw new Error('Cloud workspace version metadata is invalid.');
    let plain;
    try {
      plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(user.id, schema, rev), tagLength: 128 }, key, ciphertext);
    } catch (_) { throw new Error('Cloud workspace could not be authenticated. Check your sync passphrase. Local data has not been changed.'); }
    if (plain.byteLength !== Number(row.payload_bytes)) throw new Error('Cloud workspace size verification failed.');
    let parsed;
    try { parsed = JSON.parse(decoder.decode(plain)); } catch (_) { throw new Error('Decrypted cloud workspace is not valid JSON.'); }
    const checked = validateWorkspace(parsed);
    if (checked.schema !== schema) throw new Error('Cloud workspace schema metadata does not match its contents.');
    revision = rev;
    return checked.workspace;
  }
  async function unlock(passphrase) {
    user = await authenticatedUser();
    deviceId = deviceId || (crypto.randomUUID ? crypto.randomUUID() : 'device-' + toBase64(randomBytes(12)));
    const row = await readRemote();
    let deviceKey = passphrase ? null : await readDeviceKey(user.id);
    if (!passphrase && deviceKey && row && deviceKey.salt === row.salt) {
      key = deviceKey.key; salt = fromBase64(deviceKey.salt);
    } else {
      if (!passphrase) throw new Error('Enter your workspace sync passphrase to unlock this device.');
      salt = row ? fromBase64(row.salt) : randomBytes(16);
      if (salt.length !== 16) throw new Error('Cloud workspace salt is invalid.');
      key = await deriveKey(passphrase, salt);
      await storeDeviceKey(user.id, salt, key);
    }
    revision = row ? Number(row.revision) || 0 : 0;
    dirty = false;
    const workspace = row ? await decryptRow(row) : null;
    return { ok: true, hasRemote: !!row, revision, workspace, account: user.email || user.id, deviceKeyStored: !!(await readDeviceKey(user.id)) };
  }
  async function resume() {
    user = await authenticatedUser();
    const row = await readRemote();
    if (!row) throw new Error('No cloud workspace exists for this account yet. Create it from a device with your local workspace.');
    const deviceKey = await readDeviceKey(user.id);
    if (!deviceKey || deviceKey.salt !== row.salt) throw new Error('This device has not been unlocked. Enter your workspace sync passphrase.');
    key = deviceKey.key; salt = fromBase64(deviceKey.salt); revision = Number(row.revision) || 0;
    const workspace = await decryptRow(row);
    deviceId = deviceId || (crypto.randomUUID ? crypto.randomUUID() : 'device-' + toBase64(randomBytes(12)));
    dirty = false;
    return { ok: true, workspace, revision, account: user.email || user.id };
  }
  async function writeEncrypted(workspace, expectedRevision, allowCreate) {
    const checked = validateWorkspace(workspace);
    const nextRevision = expectedRevision + 1;
    const nonce = randomBytes(12);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: aad(user.id, checked.schema, nextRevision), tagLength: 128 },
      key, checked.bytes
    );
    const values = {
      user_id: user.id, revision: nextRevision, ciphertext: toBase64(new Uint8Array(encrypted)),
      salt: toBase64(salt), nonce: toBase64(nonce), encryption_version: VERSION,
      kdf_iterations: KDF_ITERATIONS, schema_version: checked.schema, payload_bytes: checked.bytes.byteLength,
      device_id: deviceId
    };
    if (allowCreate) {
      const { data, error } = await client().from(TABLE).insert(values).select('revision,updated_at').single();
      if (error) {
        if (error.code === '23505') return { ok: false, conflict: true, reason: 'A cloud workspace was created on another device. Refresh before saving.' };
        throw new Error(error.message || 'Could not create the encrypted cloud workspace.');
      }
      return { ok: true, revision: Number(data.revision), updatedAt: data.updated_at };
    }
    const { data, error } = await client().from(TABLE).update(values)
      .eq('user_id', user.id).eq('revision', expectedRevision)
      .select('revision,updated_at').maybeSingle();
    if (error) throw new Error(error.message || 'Could not update the encrypted cloud workspace.');
    if (!data) return { ok: false, conflict: true, reason: 'This workspace changed on another device. Review the latest cloud version before publishing local changes.' };
    return { ok: true, revision: Number(data.revision), updatedAt: data.updated_at };
  }
  async function create(workspace) {
    if (!user || !key || revision !== 0) throw new Error('Unlock a new cloud workspace before creating it.');
    const result = await writeEncrypted(workspace, 0, true);
    if (result.ok) { revision = result.revision; dirty = false; }
    return result;
  }
  async function push(workspace) {
    if (!user || !key) throw new Error('Cloud workspace sync is locked.');
    const row = await readRemote();
    if (!row || Number(row.revision) !== revision) {
      dirty = true;
      return { ok: false, conflict: true, remoteRevision: row ? Number(row.revision) : 0, reason: 'A newer cloud workspace version exists. Your local changes have been kept on this device.' };
    }
    const result = await writeEncrypted(workspace, revision, false);
    if (result.ok) { revision = result.revision; dirty = false; }
    else dirty = true;
    return result;
  }
  async function pull() {
    if (!user || !key) throw new Error('Cloud workspace sync is locked.');
    const row = await readRemote();
    if (!row) return { ok: false, missing: true, reason: 'No cloud workspace is available.' };
    const workspace = await decryptRow(row);
    dirty = false;
    return { ok: true, workspace, revision, updatedAt: row.updated_at, account: user.email || user.id };
  }
  async function forcePush(workspace) {
    if (!user || !key) throw new Error('Cloud workspace sync is locked.');
    const row = await readRemote();
    if (!row) return create(workspace);
    if (row.salt !== toBase64(salt)) throw new Error('The cloud workspace uses a different encryption key. This device cannot replace it.');
    const expected = Number(row.revision);
    if (!Number.isSafeInteger(expected) || expected < 1) throw new Error('The cloud workspace revision is invalid.');
    const result = await writeEncrypted(workspace, expected, false);
    if (result.ok) { revision = result.revision; dirty = false; }
    else dirty = true;
    return result;
  }
  async function poll() {
    if (!user || !key) return { ok: false, locked: true };
    const row = await readRemote();
    if (!row) return { ok: false, missing: true };
    const remoteRevision = Number(row.revision) || 0;
    if (remoteRevision <= revision) return { ok: true, changed: false, revision };
    if (dirty) return { ok: false, conflict: true, remoteRevision, localRevision: revision, reason: 'Another device has updated this workspace while you have local edits. Choose which copy to keep.' };
    const workspace = await decryptRow(row);
    return { ok: true, changed: true, workspace, revision, updatedAt: row.updated_at };
  }
  function schedulePush(workspace) {
    if (!user || !key) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      timer = null;
      try {
        const result = await push(workspace);
        if (typeof onStatus === 'function') onStatus(result.ok ? { state: 'synced', revision } : { state: 'conflict', ...result });
      } catch (error) {
        if (typeof onStatus === 'function') onStatus({ state: 'error', error: error.message });
      }
    }, 1800);
  }
  function setStatusHandler(callback) { onStatus = typeof callback === 'function' ? callback : null; }
  function getStatus() { return { unlocked: !!(user && key), userId: user?.id || null, revision, dirty }; }
  function stop() {
    if (timer) clearTimeout(timer);
    timer = null; user = null; key = null; salt = null; revision = 0; dirty = false;
  }
  global.LifeFlowCloudSync = Object.freeze({
    unlock, resume, create, push, pull, poll, forcePush, schedulePush, setStatusHandler, getStatus,
    forgetDeviceKey, stop, version: VERSION
  });
})(window);
