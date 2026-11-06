# 🚀 LifeFlow

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> A personal productivity workspace to plan your day, manage tasks, organise notes, and shape your workflow.

**© 2026 BrightShadow0.**

LifeFlow is free and open source under the MIT License. You are welcome to use, copy, modify, and distribute the project in accordance with the licence terms.

---

## 📖 Overview

LifeFlow brings everyday planning into one customisable workspace. It combines task management, a calendar, a Kanban board, and a Markdown-powered notes manager so you can organise work without jumping between multiple tools. Its themes, ambient visuals, and personalisation controls let you make the workspace feel like your own.

### 🌟 Key Features

- **Today Dashboard:** See daily priorities, progress, and your schedule at a glance.
- **Task Manager:** Create, organise, prioritise, and schedule tasks. Mark all tasks complete at once or clear completed tasks.
- **Calendar:** Review and organise tasks by date in a monthly view.
- **Kanban Board:** Move work through To Do, Doing, and Done.
- **Markdown Notes:** Write and preview Markdown with headings, nested lists, checklists, tables, blockquotes, links, images, and Mermaid diagrams.
- **Code Highlighting:** Read code blocks with syntax highlighting for several popular programming languages and theme-aware colours.
- **Your Branches:** Explore notes in a connected visual graph.
- **Themes & Appearance:** Choose from Sapphire, Emerald, Gold, Platinum, Amethyst, and Ruby, with light and dark modes.
- **Ambient Customisation:** Adjust visual intensity, scenic backgrounds, and workspace effects.
- **Task Master Easter Egg:** Generate 15 randomly scheduled sample tasks across yesterday, today, and tomorrow.
- **Profile & Preferences:** Customise profile details, localisation, account tier, and workspace settings.
- **Data Export:** Export task data as CSV or JSON.
- **Browser Persistence:** Save supported account, task, and preference data in the browser.

---

## ✨ Experience Lab

The **Experience Lab** is a separate, immersive introduction to LifeFlow. It presents the product through a cinematic road journey and a scroll-driven story, while keeping the main productivity workspace separate.

- **3D Open-Road Scene:** A custom Three.js environment with a vehicle, road, natural scenery, lighting, and a moving camera journey.
- **Scroll-Driven Story:** Nine chapters introduce LifeFlow's purpose, intended audience, approach to time and attention, local-first data model, and connected notes.
- **Five-Panel Feature Showcase:** A horizontal scrollytelling rail introduces the Task Manager, Calendar & Board, Markdown Notes, Your Branches, and workspace customisation.
- **Product Timeline:** A four-step progression from noticing priorities to making meaningful progress.
- **Integrated Access:** A sign-in and account-creation experience embedded at the end of the journey.
- **Motion-Aware Experience:** Scroll choreography and animation are designed to support the story without making the workspace itself part of the showcase.

The Experience Lab is a presentation layer, not a replacement for the core LifeFlow application.

### 3D Asset Credits

The preview uses Kenney CC0 assets for the vehicle, trees, shrubs, and modular road pieces:

- [Car Kit](https://kenney.nl/assets/car-kit)
- [Nature Kit](https://kenney.nl/assets/nature-kit)
- [City Kit (Roads)](https://kenney.nl/assets/city-kit-roads)

The road spline, terrain, lighting, roadside layout, camera path, and scroll choreography are custom LifeFlow preview code. See [Experience Lab asset credits](Updated/experience-lab/ASSET-CREDITS.md) for details.

---

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Core Frontend** | HTML5, CSS3, JavaScript |
| **3D Experience** | Three.js |
| **Animation & Scroll** | GSAP, ScrollTrigger |
| **Markdown** | Marked.js |
| **Sanitisation** | DOMPurify |
| **Diagrams** | Mermaid |
| **Storage** | Browser Local Storage |
| **Dependencies** | CDN-hosted libraries |
| **Hosting / CI** | GitHub Pages, GitHub Actions |

---

## 📸 Demos

- **[Open the LifeFlow Workspace](https://brightshadow0.github.io/LifeFlow/Updated/index.html)**
- **[Explore the Experience Lab](https://brightshadow0.github.io/LifeFlow/Updated/experience-lab/)**

---

## 🚀 Getting Started

LifeFlow is a browser-based application. There is no Node.js installation, package manager, database, or `.env` file required for the standard local setup.

### Prerequisites

- Git
- A modern web browser
- An internet connection to load the CDN-hosted libraries and 3D assets

### Local Preview

For the core application, open `Updated/index.html` in a modern browser. For the full Experience Lab, use a local web server from the repository root:

```bash
python -m http.server 8000
```

Then visit:

- Core workspace: [http://localhost:8000/Updated/](http://localhost:8000/Updated/)
- Experience Lab: [http://localhost:8000/Updated/experience-lab/](http://localhost:8000/Updated/experience-lab/)

---

## 🔐 Data & Privacy

LifeFlow currently uses browser-local storage for supported account, task, and preference data. This means data is associated with the browser and device being used; it does not automatically sync across browsers or devices. Clearing the browser's site data may remove locally stored LifeFlow data. Keep your own backups of information you cannot afford to lose.

---

## 🤝 Contributing

Suggestions, bug reports, and contributions are welcome through GitHub Issues and Pull Requests. For application changes, work in the **`Updated/`** directory.

---

## 📝 License

LifeFlow is distributed under the **MIT License**. See the [MIT License](https://opensource.org/licenses/MIT) for the terms. Please retain the copyright and licence notice in copies or substantial portions of the project.

---

## ✉️ Contact

- **Copyright holder:** [@BrightShadow0](https://github.com/BrightShadow0)
- **Email:** turingtestdummy1@gmail.com
- **Project Repository:** [BrightShadow0/LifeFlow](https://github.com/BrightShadow0/LifeFlow)
