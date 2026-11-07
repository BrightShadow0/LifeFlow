# LifeFlow

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A personal productivity workspace for tasks, planning, notes, and everyday organisation.

**© 2026 BrightShadow0**

LifeFlow is free and open source under the MIT License.

---

## Overview

LifeFlow brings tasks, schedules, notes, and personal preferences into one browser-based workspace.

## Features

- **Dashboard:** Daily priorities and progress at a glance.
- **Task Manager:** Create, schedule, prioritise, complete, or clear tasks. Includes a complete-all action.
- **Calendar:** Monthly task view.
- **Kanban Board:** Organise work across To Do, Doing, and Done.
- **Notes Manager:** Markdown editor and preview with checklists, tables, links, images, and Mermaid diagrams.
- **Code Highlighting:** Syntax-highlighted code blocks.
- **Your Branches:** Visual graph of linked notes.
- **Themes:** Sapphire, Emerald, Platinum, Amethyst, and Ruby (Amethyst is restricted to Premium and Team Admin accounts).
- **Appearance:** Light and dark modes, ambient settings, and visual intensity controls.
- **Task Master:** Easter egg that generates sample tasks across three days.
- **Profile & Settings:** Profile, localisation, account tier, and workspace preferences.
- **Data Export:** Export tasks as CSV or JSON.
- **Local Storage:** Saves supported data in the browser.

---

## Brand Identity

LifeFlow uses the Compass mark: a four-point cyan-teal compass star inside a segmented circular ring. It represents direction, clarity, balance, and purposeful progress. The mark is shared across the public landing page, login terminal, workspace sidebar, and browser favicon. Its cyan-teal treatment remains consistent across workspace colour themes and light/dark appearance modes.

The primary vector asset is `Updated/compass-mark.svg`.

---

## Authentication Updates

### Authentication v2.1 — Login handling

- Email-only login with a generic incorrect-credentials response.
- Progressive client-side lockout and a live countdown.
- Failed-attempt state resets when a lock expires.

### Authentication v2.2 — Accessibility and usability

- Login and signup fields use appropriate labels, input types, and autocomplete hints.
- Authentication step changes move keyboard focus and clear stale validation state.
- Login errors are associated with their relevant fields and announced to assistive technology.
- Password visibility controls expose their pressed state.
- Remember me is unchecked by default.
- Google and Apple provider marks use inline SVG artwork; unconfigured providers remain demo-mode actions.
- Passkey sign-in is clearly marked as coming soon until server-side WebAuthn is available.
- The login-panel tagline is real, selectable HTML text rather than generated CSS content.

**Security limitation:** The current application is a browser-only build. Client-side lockout and local CAPTCHA checks are usability deterrents, not enforceable security controls. Production authentication requires server-side credential verification, rate limiting, CAPTCHA verification, and secure session management.

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
| Storage | Browser Local Storage |
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

## Data & Privacy

Supported tasks, account details, and preferences are stored locally in the browser. They do not automatically sync between devices. Clearing browser site data may remove locally stored information, so keep backups of important data.

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
