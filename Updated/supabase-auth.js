(function (global) {
  'use strict';
  // Provider-backed auth foundation. Existing local login remains active until
  // the complete account and workspace migration is verified.
  function client() {
    const api = global.LifeFlowSupabase;
    const instance = api && api.getClient && api.getClient();
    if (!instance) throw new Error('Supabase is not available. Check the network and SDK loading.');
    return instance;
  }
  function failed(error, fallback) {
    return { ok: false, error: error && error.message ? error.message : fallback };
  }
  async function ensureProfile(user, displayName) {
    if (!user || !user.id) return { ok: false, error: 'A signed-in cloud user is required.' };
    try {
      const { error } = await client().from('account_profiles').upsert({
        id: user.id,
        display_name: String(displayName || user.user_metadata?.display_name || '').trim()
      }, { onConflict: 'id', ignoreDuplicates: true });
      return error ? failed(error, 'Cloud profile could not be initialized.') : { ok: true };
    } catch (error) { return failed(error, 'Cloud profile could not be initialized.'); }
  }
  async function signUp({ email, password, displayName } = {}) {
    if (!email || !password) return { ok: false, error: 'Enter an email address and password.' };
    if (String(password).length < 8) return { ok: false, error: 'Use a password with at least eight characters.' };
    try {
      const { data, error } = await client().auth.signUp({
        email: String(email).trim().toLowerCase(), password: String(password),
        options: { emailRedirectTo: global.location.origin + global.location.pathname, data: { display_name: String(displayName || '').trim() } }
      });
      if (error) return failed(error, 'Cloud account registration failed.');
      if (data.session && data.user) {
        const profile = await ensureProfile(data.user, displayName);
        if (!profile.ok) return profile;
      }
      return { ok: true, user: data.user ? { id: data.user.id, email: data.user.email } : null, needsEmailConfirmation: !data.session };
    } catch (error) { return failed(error, 'Cloud account registration failed.'); }
  }
  async function signIn({ email, password } = {}) {
    if (!email || !password) return { ok: false, error: 'Enter your email address and password.' };
    try {
      const { data, error } = await client().auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: String(password) });
      if (error) return failed(error, 'Cloud sign-in failed.');
      const profile = await ensureProfile(data.user);
      if (!profile.ok) return profile;
      const assurance = await client().auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) return failed(assurance.error, 'Could not verify cloud sign-in assurance.');
      if (assurance.data.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') {
        const factors = await client().auth.mfa.listFactors();
        if (factors.error) return failed(factors.error, 'Could not load authenticator factors.');
        const factor = (factors.data.totp || []).find(item => item.status === 'verified');
        if (!factor) return { ok: false, error: 'This account requires authenticator verification, but no verified factor is available. Contact support or use account recovery.' };
        return { ok: true, user: data.user ? { id: data.user.id, email: data.user.email } : null, session: !!data.session, requiresMfa: true, factorId: factor.id, currentLevel: assurance.data.currentLevel, nextLevel: assurance.data.nextLevel };
      }
      return { ok: true, user: data.user ? { id: data.user.id, email: data.user.email } : null, session: !!data.session, requiresMfa: false, currentLevel: assurance.data.currentLevel, nextLevel: assurance.data.nextLevel };
    } catch (error) { return failed(error, 'Cloud sign-in failed.'); }
  }
  async function initializeSignedInProfile() {
    try {
      const { data, error } = await client().auth.getUser();
      if (error) return failed(error, 'Could not verify the signed-in cloud account.');
      return ensureProfile(data.user);
    } catch (error) { return failed(error, 'Could not initialize the cloud profile.'); }
  }
  async function requestPasswordReset(email) {
    if (!email) return { ok: false, error: 'Enter your email address.' };
    try {
      const { error } = await client().auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo: global.location.origin + global.location.pathname });
      return error ? failed(error, 'Password reset could not be requested.') : { ok: true };
    } catch (error) { return failed(error, 'Password reset could not be requested.'); }
  }
  async function resendConfirmation(email) {
    if (!email) return { ok: false, error: 'Enter your email address.' };
    try {
      const { error } = await client().auth.resend({ type: 'signup', email: String(email).trim().toLowerCase(), options: { emailRedirectTo: global.location.origin + global.location.pathname } });
      return error ? failed(error, 'Confirmation email could not be resent.') : { ok: true };
    } catch (error) { return failed(error, 'Confirmation email could not be resent.'); }
  }
  async function completePasswordRecovery(password) {
    return updatePassword(password);
  }
  async function challengeAuthenticator(factorId) {
    if (!factorId) return { ok: false, error: 'Choose an authenticator factor.' };
    try {
      const { data, error } = await client().auth.mfa.challenge({ factorId });
      return error ? failed(error, 'Authenticator challenge failed.') : { ok: true, challengeId: data.id };
    } catch (error) { return failed(error, 'Authenticator challenge failed.'); }
  }
  async function removeAuthenticator(factorId, code) {
    if (!factorId || !/^[0-9]{6}$/.test(String(code || ''))) return { ok: false, error: 'Enter the six-digit authenticator code to remove this factor.' };
    try {
      const api = client().auth.mfa;
      const challenge = await api.challenge({ factorId });
      if (challenge.error) return failed(challenge.error, 'Authenticator challenge failed.');
      const verified = await api.verify({ factorId, challengeId: challenge.data.id, code: String(code) });
      if (verified.error) return failed(verified.error, 'Authenticator verification failed. The factor was not removed.');
      const { error } = await api.unenroll({ factorId });
      return error ? failed(error, 'Authenticator could not be removed.') : { ok: true };
    } catch (error) { return failed(error, 'Authenticator could not be removed.'); }
  }
  async function updatePassword(password) {
    if (!password || String(password).length < 8) return { ok: false, error: 'Use a password with at least eight characters.' };
    try {
      const { data, error } = await client().auth.updateUser({ password: String(password) });
      if (error) return failed(error, 'Password update failed.');
      return { ok: true, user: data.user ? { id: data.user.id, email: data.user.email } : null };
    } catch (error) { return failed(error, 'Password update failed.'); }
  }
  async function signOut() {
    try { const { error } = await client().auth.signOut({ scope: 'local' }); return error ? failed(error, 'Cloud sign-out failed.') : { ok: true }; }
    catch (error) { return failed(error, 'Cloud sign-out failed.'); }
  }
  async function getSession() {
    try {
      const { data, error } = await client().auth.getSession();
      if (error) return failed(error, 'Could not read the cloud session.');
      const session = data.session;
      return { ok: true, session: session ? { userId: session.user.id, email: session.user.email, expiresAt: session.expires_at || null } : null };
    } catch (error) { return failed(error, 'Could not read the cloud session.'); }
  }
  function onAuthStateChange(callback) {
    if (typeof callback !== 'function') return () => {};
    const { data } = client().auth.onAuthStateChange((event, session) => callback({
      event, user: session && session.user ? { id: session.user.id, email: session.user.email } : null
    }));
    return () => data.subscription.unsubscribe();
  }
  async function enrollAuthenticator() {
    try {
      const { data, error } = await client().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'LifeFlow authenticator' });
      if (error) return failed(error, 'Authenticator enrollment could not start.');
      return { ok: true, factorId: data.id, type: data.type, totp: data.totp ? { qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri } : null };
    } catch (error) { return failed(error, 'Authenticator enrollment could not start.'); }
  }
  async function cancelAuthenticatorEnrollment(factorId) {
    if (!factorId) return { ok: false, error: 'Choose the pending authenticator factor.' };
    try {
      const { error } = await client().auth.mfa.unenroll({ factorId });
      return error ? failed(error, 'Pending authenticator setup could not be cancelled.') : { ok: true };
    } catch (error) { return failed(error, 'Pending authenticator setup could not be cancelled.'); }
  }
  async function verifyAuthenticator(factorId, code) {
    if (!factorId || !/^\d{6}$/.test(String(code || ''))) return { ok: false, error: 'Enter the six-digit authenticator code.' };
    try {
      const api = client().auth.mfa, challenge = await api.challenge({ factorId });
      if (challenge.error) return failed(challenge.error, 'Authenticator challenge failed.');
      const result = await api.verify({ factorId, challengeId: challenge.data.id, code: String(code) });
      return result.error ? failed(result.error, 'Authenticator verification failed.') : { ok: true };
    } catch (error) { return failed(error, 'Authenticator verification failed.'); }
  }
  async function listAuthenticators() {
    try { const { data, error } = await client().auth.mfa.listFactors(); return error ? failed(error, 'Could not list authenticator factors.') : { ok: true, factors: data.all || [] }; }
    catch (error) { return failed(error, 'Could not list authenticator factors.'); }
  }
  async function assuranceLevel() {
    try {
      const { data, error } = await client().auth.mfa.getAuthenticatorAssuranceLevel();
      return error ? failed(error, 'Could not check authentication assurance.') : { ok: true, currentLevel: data.currentLevel, nextLevel: data.nextLevel, currentAuthenticationMethods: data.currentAuthenticationMethods || [] };
    } catch (error) { return failed(error, 'Could not check authentication assurance.'); }
  }
  global.LifeFlowCloudAuth = Object.freeze({ signUp, signIn, initializeSignedInProfile, ensureProfile, requestPasswordReset, resendConfirmation, completePasswordRecovery, challengeAuthenticator, removeAuthenticator, updatePassword, signOut, getSession, onAuthStateChange, enrollAuthenticator, cancelAuthenticatorEnrollment, verifyAuthenticator, listAuthenticators, assuranceLevel });
})(window);
