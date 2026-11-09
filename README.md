# LifeFlow

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A personal productivity workspace for tasks, planning, notes, and everyday organisation.

**© 2026 BrightShadow0**

LifeFlow is free and open source under the MIT License.

---

## Overview

LifeFlow brings tasks, schedules, calendar events, notes, and personal preferences into one browser-based workspace. It is private by default, with optional cloud services and selective calendar sharing for people who want to collaborate.

## Features

### Planning and productivity
- **Today dashboard:** Daily priorities, overdue and upcoming work, scheduled tasks, daily progress, and a separate view of today's and upcoming calendar events.
- **Task Manager:** Create and manage tasks with start and due dates, priorities, time intervals, tags, subtasks, recurring schedules, and completion status. Includes complete-all and clear-completed actions.
- **Calendar:** Month and agenda views for events and task deadlines. Create and edit events with dates, times, locations, and event details.
- **Kanban Board:** Move tasks through To Do, Doing, and Done. Calendar events are intentionally kept out of Kanban.
- **Event locations and travel planning:** Store venue details, open map directions, and add estimated travel duration and departure lead times. Travel estimates are user-entered; live traffic routing depends on a future routing integration.
- **Calendar reminders:** Configure event and guest reminder preferences. Email, push, SMS, and WhatsApp delivery depend on the corresponding provider credentials and deployed reminder services.

### Notes and knowledge
- **Notes Manager:** Markdown writing and preview, checklists, tables, links, images, and Mermaid diagrams.
- **Code highlighting:** Syntax-highlighted code blocks.
- **Your Branches:** Visualise relationships between linked notes, with backlinks and knowledge navigation.
- **Search:** Find notes and knowledge content.

### Personalisation and workspace controls
- **Themes:** Sapphire, Emerald, Platinum, Amethyst, and Ruby. Some themes and workspace capabilities are tier-restricted.
- **Appearance:** Light and dark modes, theme accents, ambient settings, and visual intensity controls.
- **Profile & Settings:** Profile identity, avatar, localisation, account preferences, and automatic logout.
- **Task Master:** Optional sample-task generator for exploring the task workflow.
- **Data management:** Workspace health indicators, local recovery points, portable workspace exports, and restore safeguards.
- **Data export:** Export supported task data as CSV or workspace data as JSON.

### Optional cloud and collaboration
- **Cloud account:** Optional Supabase-backed email/password authentication and authenticator-based two-factor verification.
- **Encrypted cloud backups:** Manually create, list, restore, and delete client-side encrypted workspace backups. The backup passphrase is separate from the cloud account password.
- **Encrypted multi-device workspace sync:** A separate encrypted workspace-sync service designed to unlock the same workspace on multiple devices using a user-held sync passphrase. Cross-device sign-in and sync should be treated as deployment-dependent until verified end to end.
- **Shared calendars:** Invite specific people to selected calendars, manage read-only or read-write access, and revoke access. Only events explicitly published to a shared calendar are shared; the rest of the workspace remains private.
- **Calendar notifications:** In-app notifications and configurable guest reminder channels. External delivery requires the relevant services and credentials to be configured.

---

## Brand Identity

LifeFlow's identity is built around a distinctive geometric symbol and a clean wordmark.

- **Symbol:** Three ascending, softly rounded, slanted bars. Their rising heights suggest momentum, progress, and ideas taking shape.
- **Colour:** A coordinated cyan, electric-blue, and violet gradient gives the mark its recognisable energy. The colours transition from cool cyan through blue to violet.
- **Wordmark:** The name **LifeFlow** uses a bold, tightly tracked sans-serif treatment. The wordmark pairs with the symbol as one unified lockup.
- **Tagline:** The primary logo lockup is intentionally kept clean, without secondary side text or a tagline.
- **Use:** Keep the symbol and wordmark proportions, spacing, and gradient consistent across the public website, Login Terminal, workspace, and browser identity. The logo should remain legible against both dark and light surfaces.

The primary vector symbol is `Updated/compass-mark.svg`. The filename is retained for compatibility; the artwork is the three-bar LifeFlow mark, not a compass icon. Shared wordmark styling is defined in `Updated/brand.css`.

---

## Three-Stage Experience

LifeFlow is organised into three distinct stages. Each stage owns its layout and visual identity, and theme preferences must not leak between stages.

1. **Why LifeFlow** — the public-facing product website, with its own page and stylesheet.
2. **Login Terminal** — the authentication experience, with its own saved appearance preference.
3. **LifeFlow Workspace** — the signed-in application. Workspace appearance is stored with the user's profile and applies only to the workspace.

The Login Terminal and authenticated workspace are separate application stages. Successful sign-in switches the page title to **LifeFlow**; logging out restores **LifeFlow Login Terminal**. Workspace ambient settings are cleared when returning to the login stage.

Keep future design and theme changes scoped to their owning stage. Do not use a workspace theme change to restyle the public website or Login Terminal.

## Tech Stack

| Area | Technology |
| :--- | :--- |
| Frontend | HTML, CSS, JavaScript |
| Motion | CSS transitions |
| Markdown | Marked.js |
| Sanitisation | DOMPurify |
| Diagrams | Mermaid |
| Local workspace storage | Browser Local Storage and IndexedDB recovery |
| Optional cloud services | Supabase Auth, PostgreSQL, Row Level Security, Realtime, Edge Functions |
| Encryption | Web Crypto API (AES-GCM; passphrase-derived keys) |
| Hosting / CI | GitHub Pages, GitHub Actions |

---

## Demos

- [LifeFlow Workspace](https://brightshadow0.github.io/LifeFlow/Updated/index.html)

---

## Getting Started

### Requirements

- Git
- A modern web browser
- Internet connection for CDN-hosted libraries and fonts

### Run Locally

From the repository root, run:

```bash
python -m http.server 8000
```

Open:

- [http://localhost:8000/Updated/](http://localhost:8000/Updated/)

No Node.js setup, package manager, database, or environment file is required for the standard preview.

---

## Privacy, Sharing & Data Control

LifeFlow is **private by default, with optional sharing when the user chooses it**. Collaboration does not make the whole workspace public.

- **Local-first workspace:** Core workspace data is stored in the user's browser. Local data is not automatically visible to other LifeFlow users.
- **Optional cloud account:** Users may choose to connect a cloud account. Cloud authentication is separate from the local workspace profile.
- **Encrypted cloud backups:** Backups are opt-in and manually created. Workspace content is encrypted in the browser before upload; the cloud service stores encrypted backup data. The user must retain the backup passphrase because it cannot be reset by LifeFlow.
- **Multi-device sync:** The separate workspace-sync feature is designed to encrypt workspace data in the browser before synchronisation. It requires the same sync passphrase on each device. Do not assume that cloud backup and live workspace sync are the same feature.
- **Selective calendar sharing:** A user can invite named people to a specific shared calendar and assign read-only or read-write access. Only events the owner explicitly publishes to that shared calendar are shared with its members. The owner's tasks, private notes, profile, and other calendars are not automatically shared.
- **Sharing permissions:** Calendar owners manage membership, roles, and revocation. Invited members cannot invite additional people. Invitation links are time-limited and are accepted by the signed-in account matching the invited email.
- **Important sharing distinction:** Shared-calendar event records are stored in dedicated Supabase tables and are not currently described as end-to-end encrypted. Share only event details that are appropriate for the invited members to see.
- **Local recovery:** Browser recovery points protect against some local data mistakes but are not cloud backups. They do not protect against losing the device, uninstalling the browser, or clearing browser site data.
- **User control:** Users decide whether to connect cloud services, create backups, or publish events to a shared calendar. Keep a separate export or backup of important information.

### Service and deployment requirements

The local workspace can be previewed without a Supabase project. Optional cloud features require the Supabase schema migrations and relevant Edge Functions to be deployed. Calendar email, push, SMS, and WhatsApp reminders also require their provider credentials and a configured scheduler. A successful frontend build does not by itself confirm that these external services are active. See [Supabase service setup](supabase/README.md) and the [cloud security architecture](Updated/CLOUD-SECURITY-ARCHITECTURE.md) for implementation and deployment details.

---

## Contributing

Report bugs and suggest improvements through GitHub Issues or Pull Requests. Make application changes in `Updated/`.

---

## License

LifeFlow is distributed under the [MIT License](https://opensource.org/licenses/MIT). Retain the copyright and licence notice in copies or substantial portions of the project.

---

## Contact

- GitHub: [@BrightShadow0](https://github.com/BrightShadow0)
- Email: turingtestdummy1@gmail.com
- Repository: [BrightShadow0/LifeFlow](https://github.com/BrightShadow0/LifeFlow)
