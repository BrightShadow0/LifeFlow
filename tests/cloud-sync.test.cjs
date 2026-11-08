const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function harness(shared = { rows: [] }, userId = 'user-a') {
  const rows = shared.rows;
  const user = { id: userId, email: userId + '@example.test' };
  const dbClient = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }) }
    },
    from(table) {
      assert.equal(table, 'encrypted_workspace_sync');
      let mode = 'select', values = null, filters = [];
      const matches = row => filters.every(([key, value]) => row[key] === value);
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        maybeSingle: async () => ({ data: rows.find(matches) || null, error: null }),
        single: async () => {
          if (mode === 'insert') {
            if (rows.some(row => row.user_id === values.user_id)) return { data: null, error: { code: '23505', message: 'duplicate' } };
            const row = { ...values, updated_at: new Date().toISOString() }; rows.push(row); return { data: { revision: row.revision, updated_at: row.updated_at }, error: null };
          }
          return { data: null, error: { message: 'unsupported single' } };
        },
        insert(next) { mode = 'insert'; values = next; return query; },
        update(next) { mode = 'update'; values = next; return query; },
        then(resolve, reject) {
          if (mode !== 'update') return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          const row = rows.find(matches);
          if (!row) return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          Object.assign(row, values, { updated_at: new Date().toISOString() });
          return Promise.resolve({ data: { revision: row.revision, updated_at: row.updated_at }, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const context = {
    window: null, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer,
    JSON, Date, Math, Number, String, Object, Error, Promise, RegExp, setTimeout, clearTimeout,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    indexedDB: { open() { const request = {}; queueMicrotask(() => { request.onerror && request.onerror(); }); return request; } },
    LifeFlowSupabase: { getClient: () => dbClient }
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync('Updated/cloud-sync.js', 'utf8'), context, { filename: 'cloud-sync.js' });
  return { api: context.LifeFlowCloudSync, rows, shared };
}
const workspace = (title = 'Private task') => ({
  currentUser: 'person@example.test', tasks: [{ id: 'task-1', title }],
  notes: [{ id: 'note-1', title: 'Private note', body: 'private body' }],
  codeNotes: [], folders: [], noteLinks: [], __lifeFlowSchemaVersion: 1
});
const passphrase = 'a correct sync passphrase';

test('creates an encrypted cloud workspace without sending readable task content', async () => {
  const h = harness();
  const unlocked = await h.api.unlock(passphrase);
  assert.equal(unlocked.hasRemote, false);
  const created = await h.api.create(workspace());
  assert.equal(created.ok, true);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].ciphertext.includes('Private task'), false);
  assert.equal(h.rows[0].ciphertext.includes('private body'), false);
  assert.equal(h.rows[0].revision, 1);
});

test('a second device can decrypt the shared workspace with the same passphrase', async () => {
  const shared = { rows: [] };
  const first = harness(shared);
  await first.api.unlock(passphrase);
  await first.api.create(workspace());
  const second = harness(shared);
  const opened = await second.api.unlock(passphrase);
  assert.equal(opened.hasRemote, true);
  assert.equal(opened.workspace.tasks[0].title, 'Private task');
  assert.equal(opened.revision, 1);
});

test('revision-checked pushes reject stale writes instead of overwriting newer data', async () => {
  const shared = { rows: [] };
  const first = harness(shared), second = harness(shared);
  await first.api.unlock(passphrase); await first.api.create(workspace('first'));
  await second.api.unlock(passphrase);
  assert.equal((await second.api.push(workspace('second'))).ok, true);
  const stale = await first.api.push(workspace('stale overwrite'));
  assert.equal(stale.ok, false); assert.equal(stale.conflict, true);
  assert.equal(shared.rows[0].revision, 2);
});

test('poll detects a remote revision change and decrypts the newer workspace', async () => {
  const shared = { rows: [] };
  const first = harness(shared), second = harness(shared);
  await first.api.unlock(passphrase); await first.api.create(workspace('v1'));
  await second.api.unlock(passphrase); await second.api.push(workspace('v2'));
  const result = await first.api.poll();
  assert.equal(result.changed, true);
  assert.equal(result.workspace.tasks[0].title, 'v2');
  assert.equal(result.revision, 2);
});

test('another authenticated user cannot read or decrypt the first user workspace', async () => {
  const shared = { rows: [] };
  const first = harness(shared, 'user-a'), second = harness(shared, 'user-b');
  await first.api.unlock(passphrase); await first.api.create(workspace());
  const opened = await second.api.unlock(passphrase);
  assert.equal(opened.hasRemote, false);
  assert.equal(shared.rows.length, 1);
});

test('rejects weak passphrases and malformed workspace payloads', async () => {
  const h = harness();
  await assert.rejects(h.api.unlock('too-short'), /12 to 1,024/);
  await h.api.unlock(passphrase);
  await assert.rejects(h.api.create({ tasks: {} }), /collection "tasks" is invalid/);
  assert.equal(h.rows.length, 0);
});
