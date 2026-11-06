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
- **Themes:** Sapphire, Emerald, Gold, Platinum, Amethyst, and Ruby.
- **Appearance:** Light and dark modes, ambient settings, and visual intensity controls.
- **Task Master:** Easter egg that generates sample tasks across three days.
- **Profile & Settings:** Profile, localisation, account tier, and workspace preferences.
- **Data Export:** Export tasks as CSV or JSON.
- **Local Storage:** Saves supported data in the browser.

---

## Experience Lab

A separate, scroll-driven introduction to LifeFlow.

- Continuous Three.js road environment with textured asphalt, lane markings, road shoulders, guardrails, forest, terrain, atmospheric sky and fog.
- Custom touring-car model with metallic paint, environment reflections, glass, lighting, alloy wheels, brake detail and stable road contact.
- Nine-chapter scroll-driven story.
- Five vertically unfolding feature chapters covering tasks, calendar and board, notes, linked notes, and customisation.
- Four-step product timeline and current-feature showcase.
- Embedded sign-in and account creation with wheel, touch and keyboard scrolling passed through to the parent page.

The Experience Lab is a product showcase. The main workspace remains a separate application. Its 3D car, road, forest and sky are generated in code. See [ASSET-CREDITS.md](Updated/experience-lab/ASSET-CREDITS.md).

### Experience Lab Continuity Rules

These standards apply to all future Experience Lab versions:

- Keep one continuous visual world behind the full page. Do not introduce hard section seams, sudden palette resets, blank animation states or slide-like loading transitions.
- Let feature chapters unfold vertically in the shared scene. Avoid full-screen horizontal panels that behave like a presentation deck.
- Keep the car grounded to the road surface. Wheel contact, road height, camera framing and model scale must remain consistent throughout the journey.
- Keep all interface text above the 3D canvas. Shadows and scene effects must never obscure, overlap or reduce text legibility.
- Prevent overlap at desktop, tablet and mobile widths. Recheck long headings, cards, navigation and embedded authentication.
- Embedded controls must not trap page scrolling. Forward wheel, touch and suitable keyboard scroll input to the parent page while preserving normal form interaction.
- Keep the scene usable when WebGL is unavailable and respect reduced-motion settings.
- Prefer coherent physical materials, lighting, reflections, surface detail and believable proportions over placeholder or low-poly props.

The main LifeFlow workspace remains independent from the Experience Lab.

---

## Tech Stack

| Area | Technology |
| :--- | :--- |
| Frontend | HTML, CSS, JavaScript |
| 3D | Three.js |
| Motion | CSS transitions, scroll-driven JavaScript |
| Markdown | Marked.js |
| Sanitisation | DOMPurify |
| Diagrams | Mermaid |
| Storage | Browser Local Storage |
| Hosting / CI | GitHub Pages, GitHub Actions |

---

## Demos

- [LifeFlow Workspace](https://brightshadow0.github.io/LifeFlow/Updated/index.html)
- [Experience Lab](https://brightshadow0.github.io/LifeFlow/Updated/experience-lab/)

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

- Workspace: [http://localhost:8000/Updated/](http://localhost:8000/Updated/)
- Experience Lab: [http://localhost:8000/Updated/experience-lab/](http://localhost:8000/Updated/experience-lab/)

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
