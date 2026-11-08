(function (global) {
  'use strict';

  // This is a Supabase publishable key, intended for browser use.
  // Database access must still be protected by RLS on every exposed table.
  // Never place service_role/secret keys in this file.
  const SUPABASE_URL = 'https://krfzkaykxyagwrqabizp.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_TmP1V75caUoapi0ZPA89hQ_iS091a-1';

  let client = null;
  let initializationError = null;

  function initialize() {
    if (client) return client;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      initializationError = new Error('Supabase SDK did not load.');
      return null;
    }

    try {
      client = global.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          // Supabase-managed sessions are isolated from LifeFlow's legacy local session keys.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        global: {
          headers: { 'X-Client-Info': 'lifeflow-local-first-web' }
        }
      });
      initializationError = null;
      return client;
    } catch (error) {
      initializationError = error;
      return null;
    }
  }

  function getStatus() {
    return {
      configured: true,
      initialized: !!client,
      authMigrationEnabled: false,
      authSessionPersistence: true,
      error: initializationError ? initializationError.message : null
    };
  }

  async function checkDatabaseReady() {
    const supabaseClient = initialize();
    if (!supabaseClient) {
      return { ready: false, reason: initializationError ? initializationError.message : 'Supabase is unavailable.' };
    }

    const result = await supabaseClient
      .from('account_profiles')
      .select('id')
      .limit(1);

    if (result.error) {
      return {
        ready: false,
        reason: result.error.code === '42P01' || result.error.code === 'PGRST205'
          ? 'Database migration has not been applied yet.'
          : 'Database check failed. Review the Supabase project and RLS configuration.',
        code: result.error.code || null
      };
    }

    return { ready: true, reason: 'Supabase database table is reachable. No user data was read.' };
  }

  initialize();

  global.LifeFlowSupabase = Object.freeze({
    url: SUPABASE_URL,
    getClient: initialize,
    getStatus,
    checkDatabaseReady
  });
})(window);
