# LifeFlow Release 6 · Deployment and Data Protection

## Scope

Release 6 strengthens the current local-first website with a separate IndexedDB recovery vault, non-destructive workspace schema tagging, safer restore operations and deployment checks.

The current application does not yet have a server-side database or a cloud backup service. The recovery vault is stored in the same browser profile and on the same device. It is intended to help with accidental local-save damage or an incorrect restore, not device loss.

## Storage boundaries

- Primary workspace data remains account-scoped in `localStorage` using the existing `lifeflow2_state_` key contract.
- The existing `lifeflow2_users` account/profile contract remains unchanged.
- Recovery points are stored separately in IndexedDB database `lifeflow-recovery-v1`.
- Up to 12 recovery points are retained per account. Automatic checkpoints are throttled to one every two minutes after a successful primary workspace save. Users can also save a manual point.
- Browser persistent-storage permission is requested only after the user selects **Enable browser storage protection**.
- Encrypted Master Archive export/import remains the portable off-device backup method.

## Non-negotiable deployment rules

1. Keep the deployed application on the same origin (scheme, host and port). Moving from localhost to a different port, domain or protocol creates a different browser storage area.
2. Never call `localStorage.clear()` or remove `lifeflow2_users`, `lifeflow2_state` or `lifeflow2_state_*` during a normal deployment.
3. Do not rename existing storage keys. Introduce new keys additively and keep old readers available for a migration window.
4. Workspace migrations must preserve unknown fields. A migration must never silently replace invalid or unrecognised user content with empty arrays.
5. Keep `workspace.html` asset query versions updated when changing cached scripts or styles.
6. Do not overwrite the user's browser database as part of a static-site deployment. Deploy application assets only.
7. Before any migration that changes stored user content, ensure a recent recovery point exists and keep the existing encrypted Master Archive workflow available.
8. Roll back application code independently. Never automatically restore an older data snapshot merely because application code is rolled back.

## Deployment checklist

### Before deployment

- Confirm the LifeFlow safety-check workflow passes.
- Sign in using a non-production/test profile and smoke-test tasks, notes, folders, settings and calendar views.
- Create an encrypted Master Archive and store it outside the browser profile.
- Confirm the Recovery History panel lists a recent local checkpoint.
- Review changes for accidental storage clearing, key renaming or destructive schema operations.

### During maintenance

- Serve `maintenance.html` as the temporary static page where the hosting setup supports a maintenance route.
- Do not run a workspace reset, account cleanup or database migration as part of maintenance.
- Keep the existing site origin unchanged.
- The maintenance page is static and does not run application code or access browser storage.

### After deployment

- Open `workspace.html` on the existing origin and sign in.
- Verify existing tasks, notes, folders and account preferences are present.
- Open Profile & settings → Data Management and check Data Health and Recovery History.
- Test creating a task, refreshing, and confirming it remains.
- Test archive export on a test profile before any production restore workflow is considered complete.
- If a release fails, roll back the application assets while leaving browser storage untouched.

## Recovery limits users must understand

- IndexedDB recovery points are local to the same browser profile and device.
- Clearing site data, deleting the browser profile, uninstalling a browser or losing the device can remove both primary data and the recovery vault.
- A persistent-storage grant can reduce automatic browser eviction but cannot protect against deliberate clearing, device failure or physical loss.
- For device-loss protection, users must keep a separate encrypted Master Archive until cloud backup is implemented in a later release.

## CI checks

The GitHub Actions workflow runs JavaScript syntax checks and verifies that the recovery module loads before the main workspace script. The workflow is a quality gate; repository branch protection must be enabled separately if merges or direct pushes should be blocked when checks fail.
