const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

function harness() {
  const rows = [];
  let user = { id: 'user-a', email: 'a@example.test' };
  let failInsert = false;
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      assert.equal(table, 'encrypted_workspace_backups');
      let inserted;
      let selected = '';
      let filters = [];
      let deleting = false;
      const query = {
        insert(row) { inserted = row; return query; },
        select(fields) { selected = fields; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        order() { return query; },
        limit() { return query; },
        single: async () => {
          if (inserted) {
            if (failInsert) return { data: null, error: { message: 'simulated upload failure' } };
            const data = { ...inserted, id: 'backup-' + (rows.length + 1), created_at: new Date().toISOString(), payload_bytes: inserted.payload_bytes };
            rows.push(data); return { data, error: null };
          }
          const row = rows.find(item => filters.every(([key, value]) => item[key] === value));
          return row ? { data: row, error: null } : { data: null, error: { message: 'not found' } };
        },
        then(resolve, reject) {
          if (deleting) return Promise.resolve().then(() => resolve({ data: null, error: null }), reject);
          const result = rows.filter(item => filters.every(([key, value]) => item[key] === value))
            .map(item => ({ id:item.id,label:item.label,created_at:item.created_at,payload_bytes:item.payload_bytes,encryption_version:item.encryption_version,workspace_schema_version:item.workspace_schema_version }));
          return Promise.resolve({ data: result, error: null }).then(resolve, reject);
        },
        delete() { deleting = true; return query; }
      };
      return query;
    }
  };
  const context = { crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, JSON, Date, Math, Number, String, Object, Error, Promise, btoa, atob, window: null };
  context.window = context;
  context.LifeFlowSupabase = { getClient: () => client };
  vm.runInNewContext(fs.readFileSync('Updated/cloud-backup.js','utf8'), context, { filename:'cloud-backup.js' });
  return { api: context.LifeFlowCloudBackup, rows, setUser(value) { user = value; }, setFailInsert(value) { failInsert = value; } };
}
const sample = () => ({ currentUser:'a@example.test', tasks:[{id:'t1',title:'Private task'}], notes:[{id:'n1',body:'Private note'}], codeNotes:[], folders:[], noteLinks:[], __lifeFlowSchemaVersion:1 });
const passphrase = 'correct horse battery staple';

test('encrypts before upload and restores an identical workspace', async () => {
  const h = harness();
  const result = await h.api.createBackup(sample(), passphrase);
  assert.equal(result.ok, true);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].ciphertext.includes('Private task'), false);
  const restored = await h.api.decryptBackup(result.backup.id, passphrase);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.workspace)), sample());
  assert.equal(restored.verified, true);
});

test('rejects weak or whitespace-only passphrases and malformed workspace', async () => {
  const h = harness();
  await assert.rejects(h.api.createBackup(sample(), 'short'), /12 and 1,024/);
  await assert.rejects(h.api.createBackup(sample(), '            '), /only spaces/);
  await assert.rejects(h.api.createBackup({ tasks:{} }, passphrase), /tasks/);
  assert.equal(h.rows.length, 0);
});

test('rejects wrong passphrase without exposing plaintext', async () => {
  const h = harness();
  const backup = await h.api.createBackup(sample(), passphrase);
  await assert.rejects(h.api.decryptBackup(backup.backup.id, 'another secure passphrase'), /integrity verification failed/);
});

test('rejects tampered ciphertext and altered metadata', async () => {
  const h = harness();
  const backup = await h.api.createBackup(sample(), passphrase);
  const row = h.rows[0];
  const envelope = JSON.parse(row.ciphertext);
  envelope.ciphertext = envelope.ciphertext.slice(0,-4) + 'AAAA';
  row.ciphertext = JSON.stringify(envelope);
  await assert.rejects(h.api.decryptBackup(backup.backup.id, passphrase));
  envelope.iterations = 1;
  row.ciphertext = JSON.stringify(envelope);
  await assert.rejects(h.api.decryptBackup(backup.backup.id, passphrase), /metadata/);
});

test('isolates backup lookup by authenticated account', async () => {
  const h = harness();
  const backup = await h.api.createBackup(sample(), passphrase);
  h.setUser({ id:'user-b', email:'b@example.test' });
  await assert.rejects(h.api.decryptBackup(backup.backup.id, passphrase), /could not be found/);
  assert.equal((await h.api.listBackups()).backups.length, 0);
});

test('deletes only the selected account backup', async () => {\n  const h = harness();\n  const backup = await h.api.createBackup(sample(), passphrase);\n  await h.api.deleteBackup(backup.backup.id);\n  assert.equal(h.rows.length, 0);\n});\n\ntest('reports failed uploads and rejects malformed backup identifiers', async () => {
  const h = harness();
  h.setFailInsert(true);
  await assert.rejects(h.api.createBackup(sample(), passphrase), /simulated upload failure/);
  await assert.rejects(h.api.decryptBackup('', passphrase), /identifier is invalid/);
});
