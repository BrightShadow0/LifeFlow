# LifeFlow Cloud & Security Architecture

Status: Approved architecture baseline
Scope: Backend authentication, optional two-factor authentication, secure sessions, encrypted cloud backup, and multi-device recovery.
Compatibility: Preserve the current local-first workspace and Release 6 Recovery Vault. This document is an implementation contract, not a claim that cloud security features are already active.

## Product principles

1. Local-first remains the default. A backend outage must not erase or make the user's local workspace unusable.
2. Security controls must be real and server-enforced. Never show an enabled 2FA state unless the server confirms it.
3. 2FA is optional and off by default. Users choose whether to enroll.
4. Cloud backup and sync are opt-in, clearly distinguished from same-device browser recovery.
5. No migration may overwrite or delete local data without a verified backup, explicit consent, and a recoverable rollback path.
6. Do not store passwords, TOTP secrets, recovery codes, bearer tokens, or encryption keys in plaintext in localStorage.

## 1. Authentication and sessions

Replace browser-authoritative account/session logic with a backend identity service before enabling cloud accounts.

- Passwords are verified server-side using a modern password hashing scheme (Argon2id preferred; use a vetted library and deployment-supported parameters).
- OAuth identity tokens are validated by the backend, including issuer, audience, signature, expiry, and nonce/state checks. A frontend demo provider must never be treated as authenticated.
- The server creates an opaque session and sets it in a Secure, HttpOnly, SameSite cookie. Do not expose session secrets to JavaScript or store them in localStorage/sessionStorage.
- Rotate the session identifier after password authentication, successful 2FA, privilege changes, and sensitive account changes.
- Enforce idle and absolute expiry server-side. Revoke sessions server-side on logout, password reset, account recovery, and security events.
- Provide a device/session list and "sign out other sessions" control.
- Use CSRF protection for cookie-authenticated state-changing requests, strict origin checks, HTTPS, and appropriate security headers.

## 2. Optional authenticator-based 2FA

### User experience

Location: Profile & Settings → Security.

- Default status: Off.
- Explain that 2FA adds a second step after password or supported OAuth sign-in.
- User explicitly selects "Set up authenticator app".
- Support standards-based TOTP compatible with Google Authenticator, Microsoft Authenticator, 1Password, and other RFC 6238 apps.
- Generate the secret on the server. Show a QR code and a manual setup key only during the pending enrollment flow.
- Require a valid six-digit code to confirm enrollment. Do not mark 2FA enabled before confirmation.
- Use Supabase Auth's TOTP factor enrollment, challenge, verification, and assurance-level APIs. Supabase Auth does not currently issue built-in one-time recovery codes for end users.
- For the initial release, let users enroll a second authenticator factor as a backup and explain how to store it separately. Do not display invented or client-generated recovery codes.
- On subsequent logins, a user with a verified factor must complete the AAL1-to-AAL2 challenge before LifeFlow reveals protected workspace data or performs protected operations.
- Allow disabling or replacing a factor only through Supabase Auth's supported factor-management flow, with recent authentication and second-factor proof where required. Notify users of security changes where a trusted notification channel is configured.
- If LifeFlow later requires one-time recovery codes, implement a dedicated server-side service with salted hashes, atomic single-use consumption, rate limits, audit events, and a tested account-recovery process. Never silently bypass the second factor.

### Server-side security requirements

- Let Supabase Auth manage TOTP factor secrets and verification. Never copy factor secrets into LifeFlow profile tables or logs.
- Supabase's documented TOTP implementation uses six-digit codes, 30-second time steps, and a one-step clock-skew allowance. Keep LifeFlow aligned with provider behavior.
- Do not create a parallel TOTP implementation in application code.
- Rate-limit challenge attempts by account and network signals; apply progressive delays/temporary lockout and security logging without leaking whether an account exists.
- Protect enrollment start/confirm endpoints against CSRF and replay. Pending enrollment secrets expire and are invalidated after confirmation or cancellation.
- Do not log TOTP values, recovery codes, provisioning URIs, passwords, session cookies, or secrets.
- 2FA must apply consistently to password and OAuth sign-in when enabled.
- Do not use SMS as the default second factor. Passkeys/WebAuthn can be added as a later stronger option.

### Suggested API contract

All endpoints are HTTPS, same-origin where possible, CSRF-protected when cookie authenticated, and return generic authentication errors.

| Endpoint | Purpose |
| --- | --- |
| POST /api/auth/signup | Create account |
| POST /api/auth/login | Verify primary credential; return authenticated session only if 2FA is off, otherwise a restricted challenge |
| POST /api/auth/oauth/callback | Validate provider assertion and apply the same 2FA policy |
| Supabase Auth MFA enroll | Start TOTP factor enrollment and return a pending QR/secret for the current user |
| Supabase Auth MFA challenge + verify | Verify the user's TOTP and promote the session to AAL2 |
| Supabase Auth MFA listFactors + unenroll | List and remove verified factors after the required re-authentication |
| Optional future recovery-code Edge Function | Only if product requirements justify custom one-time codes; hash and consume codes server-side atomically |
| GET /api/auth/sessions | List active sessions/devices, excluding secrets |
| DELETE /api/auth/sessions/{id} | Revoke one session |
| POST /api/auth/logout | Revoke current server session |

### Login state machine

1. Anonymous → primary credential submitted.
2. Primary credential invalid → generic failure, rate-limited.
3. Primary credential valid and 2FA off → server session established.
4. Primary credential valid and 2FA on → short-lived challenge only; no workspace or account API access.
5. Valid TOTP → Supabase session reaches AAL2; only then reveal protected workspace data and permit protected operations.
6. Invalid/expired challenge → reject, rate-limit, and require primary authentication again when appropriate.

## 3. Encrypted cloud backup and multi-device recovery

- Keep Release 6 IndexedDB Recovery Vault as same-browser/device recovery, not cloud backup.
- Cloud backup is a separate, opt-in capability with visible last-successful-backup time and clear error state.
- Prefer client-side encryption before upload so the service stores ciphertext, not readable workspace content. The encryption key must not be sent to the server.
- Use vetted Web Crypto primitives and versioned key envelopes. Use authenticated encryption (AES-GCM with unique nonces); never invent a cryptographic construction.
- Derive a backup key from a user-held recovery passphrase using a memory-hard KDF where supported, or use a properly designed envelope/key-wrapping scheme. Document the recovery implications before launch. Losing the only decryption key must not be presented as recoverable by support.
- Encrypt metadata that could reveal sensitive user activity where practical. Minimize server-side metadata.
- Use versioned, immutable backup objects and integrity verification. Restore into a preview/staging workspace first; never silently merge or overwrite current local data.
- Provide explicit conflict resolution for multi-device changes. No last-write-wins data loss for tasks, notes, or folders.
- Maintain a documented retention/deletion policy and provide account export and account deletion workflows.
- Test backup corruption, interrupted uploads, expired sessions, device loss, key loss, and restore rollback.

## 4. Local data migration

- Preserve existing localStorage workspace keys and Release 6 IndexedDB snapshots during authentication migration.
- Do not automatically upload existing workspace content when a user creates or links a cloud account.
- Show a migration preview: account identity, data categories, estimated size, encryption/recovery explanation, and explicit opt-in.
- Create a fresh local recovery checkpoint and downloadable archive before any migration.
- Migrate in bounded, retryable batches with checksums and idempotency keys.
- Verify remote ciphertext and a test decrypt/restore before marking migration complete.
- Keep local data untouched until the user confirms the remote copy is healthy.
- Provide rollback to local-only mode without deleting cloud data unless the user separately requests deletion.

## 5. Security settings UI

Profile & Settings → Security should eventually contain:

- Account security status and signed-in email.
- Two-factor authentication: Off / On, setup, manage/remove authenticator factors, and clear backup-factor guidance.
- Active devices and sessions with last activity and revoke controls.
- Cloud backup: Off / On, last backup, backup now, encryption/recovery status.
- Data migration and restore history.
- Recent security activity and account recovery guidance.

All statuses and actions must be backed by authenticated API responses. Hide or disable unavailable controls until the backend capability is deployed. Do not persist a client-only "2FA enabled" flag.

## 6. Delivery sequence and acceptance criteria

### Phase A — Backend foundation
- Select and document the backend/auth provider and hosting environment.
- Implement server-side identity, OAuth validation, secure cookie sessions, CSRF protection, rate limiting, session revocation, audit events, and account recovery.
- Keep local-only mode working throughout.

### Phase B — Optional 2FA
- Implement Supabase TOTP enrollment, confirmation, challenge, AAL enforcement, factor management, rate limits, and security notifications. Do not claim one-time recovery codes unless the custom recovery-code service is separately implemented and audited.
- Verify that users who do not opt in retain the normal login flow.
- Verify that users who opt in cannot access authenticated APIs before completing the challenge.
- Test replay, expiry, clock drift, brute-force throttling, OAuth login, session assurance enforcement, factor removal, and lost-authenticator recovery.

### Phase C — Encrypted cloud backup
- Implement client-side encryption, upload/download, immutable versions, integrity checks, retention, and explicit opt-in.
- Prove that server storage contains ciphertext and that the user can restore on a second device.

### Phase D — Multi-device sync and recovery
- Add conflict-safe synchronization, device management, recovery workflows, and migration/rollback.
- Validate offline edits and interrupted network behavior.

### Release gate
Do not advertise cloud authentication, 2FA, cloud backup, or multi-device recovery as available until the corresponding server-side acceptance tests pass in a deployed environment. A passing frontend build alone is not sufficient.

## Supabase provider decision

Supabase is the selected backend candidate for the initial integration because it provides managed Auth, PostgreSQL, Row Level Security, and TOTP MFA APIs. Its TOTP MFA feature is available on all projects; optional enrollment is supported by the Auth APIs. Supabase Auth does not provide built-in one-time user recovery codes, so the first implementation will support a separately enrolled backup authenticator factor. Any custom recovery-code feature requires a separate server-side design and security review.

The current static GitHub Pages frontend uses browser JavaScript. Supabase's browser client normally manages its session in browser storage, which is accessible to JavaScript. If LifeFlow retains a strict HttpOnly-cookie requirement, add a server-side/BFF layer using the supported Supabase SSR pattern rather than claiming browser SDK sessions are HttpOnly. In either design, enforce AAL requirements in database RLS and server-side functions for sensitive operations.

## Current implementation status

- Release 6 local Recovery Vault: implemented; same browser/device only.
- Backend identity/session service: not yet implemented.
- TOTP 2FA: architecture specified; not active.
- Encrypted cloud backup: architecture specified; not active.
- Multi-device sync/recovery: architecture specified; not active.


## Release 8 implementation foundation

- Added a browser-side Supabase Auth service wrapper for email/password signup, sign-in, email password reset, password update, sign-out, session inspection, auth-state observation, TOTP enrollment/challenge/verification, factor listing, and assurance-level inspection.
- Supabase Auth SDK session persistence and automatic token refresh are enabled in Supabase-managed browser storage. This does not replace or modify the existing LifeFlow local login/session keys.
- The wrapper is loaded but is not yet connected to the visible login/signup forms and does not migrate or sync workspace data.
- Do not announce universal accounts until Site URL/redirect URLs, email SMTP/delivery, signup confirmation, password recovery, account isolation, and multi-device workspace sync have been tested end to end.
- TOTP operations are available only after a real Supabase-authenticated user session exists. Enrollment secrets/QR values must only be shown transiently to the signed-in user and never logged or stored in LifeFlow profile state.
