/* LifeFlow workspace schema migrations.
 * Migrations are additive and preserve unknown fields. Never discard an
 * unrecognised property during an application upgrade.
 */
export const CURRENT_WORKSPACE_SCHEMA_VERSION = 2;

function cloneValue(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) { /* JSON fallback */ }
  }
  return JSON.parse(JSON.stringify(value));
}

export function migrateWorkspaceState(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Workspace migration expects a saved state object.');
  }

  const defaults = options.defaults && typeof options.defaults === 'object' ? options.defaults : {};
  const currentUser = options.currentUser || input.currentUser || null;
  const source = cloneValue(input);
  const storedVersion = Number.isInteger(source.__lifeFlowSchemaVersion)
    ? source.__lifeFlowSchemaVersion
    : 0;

  if (storedVersion > CURRENT_WORKSPACE_SCHEMA_VERSION) {
    throw new Error('This workspace was saved by a newer LifeFlow version. Its data has been left untouched.');
  }

  let state = { ...cloneValue(defaults), ...source };
  let version = storedVersion;

  // Version 1 formalises the existing account-scoped workspace shape. It does
  // not rename or remove any user fields; defaults are only added when absent.
  if (version < 1) {
    ['tasks', 'notes', 'codeNotes', 'folders', 'noteLinks'].forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(state, key) && Array.isArray(defaults[key])) {
        state[key] = cloneValue(defaults[key]);
      }
    });
    version = 1;
    state.__lifeFlowSchemaVersion = version;
  }

  // Version 2 adds a separate calendar-events collection; existing task dates remain untouched.
  if (version < 2) {
    if (!Array.isArray(state.events)) state.events = [];
    version = 2;
    state.__lifeFlowSchemaVersion = version;
  }

  if (currentUser) state.currentUser = currentUser;
  return { state, migrated: storedVersion !== version, fromVersion: storedVersion, toVersion: version };
}
