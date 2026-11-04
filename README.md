# 🚀 LifeFlow

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> A personal productivity workspace to plan your day, manage tasks, organise notes, and shape your workflow.

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

## 🛠️ Tech Stack

| Category | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript |
| **Markdown** | Marked.js |
| **Sanitisation** | DOMPurify |
| **Diagrams** | Mermaid |
| **Storage** | Browser Local Storage |
| **Dependencies** | CDN-hosted libraries |
| **Hosting / CI** | GitHub Pages, GitHub Actions |

---

## 📸 Demo

**[Open the LifeFlow Live Demo](https://brightshadow0.github.io/LifeFlow/Updated/index.html)**

---

## 🚀 Getting Started

LifeFlow is a browser-based application. There is no Node.js installation, package manager, database, or `.env` file required for the standard local setup.

### Prerequisites

- Git
- A modern web browser
- An internet connection to load the CDN-hosted Markdown and diagram libraries

### Installation & Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/BrightShadow0/LifeFlow.git
   cd LifeFlow
   ```

2. **Open the application:**

   Open `Updated/index.html` in a modern browser.

   Alternatively, start a local web server from the repository root:

   ```bash
   python -m http.server 8000
   ```

   Then visit [http://localhost:8000/Updated/](http://localhost:8000/Updated/).

---

## 💡 Usage

1. Open LifeFlow and create a local account or sign in.
2. Add tasks, set priorities and dates, and organise them using the calendar or Kanban board.
3. Open **Notes Manager** to write Markdown and switch to Preview to see the rendered result.
4. Personalise the workspace from your profile and customisation settings.
5. Export task data as CSV or JSON whenever you need a copy.

### Data & Authentication Notes

LifeFlow currently stores its application data in the browser's Local Storage. Data is local to the browser and device, so it does not automatically sync across devices. The account activation, password-reset, and external sign-in flows shown in the interface are not a substitute for a configured production authentication backend. Do not use real or sensitive credentials in a demo deployment.

---

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the project.
2. Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to your branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

For application changes, work in the **`Updated/`** directory.

---

## 📝 License

This project is presented under the MIT License. See the [MIT License](https://opensource.org/licenses/MIT) for details.

---

## ✉️ Contact

- **GitHub:** [@BrightShadow0](https://github.com/BrightShadow0)
- **Email:** turingtestdummy1@gmail.com
- **Project Repository:** [BrightShadow0/LifeFlow](https://github.com/BrightShadow0/LifeFlow)
