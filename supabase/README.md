# LifeFlow Supabase foundation

This directory contains the initial database scaffold. It does not connect the deployed LifeFlow website to Supabase yet, and it does not change existing local authentication or localStorage/IndexedDB data.

## Included

- config.toml: Supabase CLI project configuration without credentials.
- migrations/20261108000100_lifeflow_cloud_foundation.sql: account profile metadata and immutable encrypted-backup records with Row Level Security (RLS).

The backup table is designed for client-side encrypted ciphertext only. Do not upload raw tasks, notes, folders, calendar events, passwords, TOTP secrets, or encryption keys.

## Prerequisites and linking

1. Create a Supabase account and a new project in the Supabase Dashboard.
2. Keep the database password in a password manager.
3. Install the Supabase CLI using https://supabase.com/docs/guides/cli
4. From the repository root, authenticate and link the project:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

5. Review the migration, then apply it:

   ```sh
   supabase db push
   ```

6. Verify in the Dashboard that both tables have RLS enabled and the listed policies are present.

## Authentication configuration

In the Supabase Dashboard:

- Configure the production Site URL and exact redirect URLs for the LifeFlow deployment origin.
- Enable only sign-in providers that have been fully configured and tested. Remove demo-mode OAuth buttons from any production authentication path.
- Configure SMTP before relying on email confirmation or password reset. Supabase's default email service is for testing and has delivery limitations.
- Enable TOTP MFA (App Authenticator) for the project. Keep enrollment optional for LifeFlow users.
- Test the AAL1-to-AAL2 login flow and ensure no authenticated workspace UI/data is exposed while a user with an enrolled factor is still at AAL1.
- Do not globally require AAL2 for every account if 2FA is optional. Apply AAL2 checks to explicitly sensitive operations where appropriate.

Supabase Auth manages TOTP factors and exposes enrollment, challenge, verify, and assurance-level APIs. Supabase Auth does not provide built-in user recovery codes. For the initial rollout, document a second authenticator factor as the backup method. If LifeFlow later requires one-time recovery codes, implement a dedicated server-side recovery-code service with salted hashes, atomic single-use consumption, rate limits, and security audit events. Never simulate recovery codes in the frontend.

## Secrets and browser configuration

- The Supabase project URL and publishable/anon key are designed for browser use when RLS is correctly configured.
- A Supabase service_role key, secret API key, database password, JWT signing secret, SMTP credential, and encryption master key must never be committed or embedded in Updated/ browser assets.
- Store server secrets in Supabase Edge Function secrets or the hosting provider's secret manager.
- Do not put credentials in GitHub Actions logs or repository files.
- Never disable RLS to make a request work.

## Current status

- Database scaffold: committed.
- Live Supabase project: not linked.
- Database migration: not applied.
- Browser client integration: not enabled.
- Backend authentication migration: not enabled.
- TOTP MFA UI/login enforcement: not enabled.
- Encrypted cloud backup and sync: not enabled.

The current LifeFlow local login, local workspace data, and Release 6 IndexedDB Recovery Vault remain the active system until a separate, tested migration release is approved.
