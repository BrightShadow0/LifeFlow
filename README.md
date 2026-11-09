# LifeFlow
**Make room for what matters.**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

LifeFlow is a professional-grade, local-first productivity ecosystem designed to reduce digital noise and foster a state of "flow." By integrating task management, strategic planning, and a connected knowledge base into a single, calm workspace, LifeFlow helps you manage your attention, not just your to-do list.

**© 2026 BrightShadow0** | Free and Open Source under the MIT License.

---

## 🌿 The Philosophy: Calm Productivity

Most productivity tools are designed for "capture"—they are loud, notification-driven, and demanding. LifeFlow is designed for **clarity**. 

It operates on the principle that your digital workspace should be a sanctuary, not another source of stress. By combining a minimalist aesthetic with powerful architectural foundations, LifeFlow allows you to move seamlessly between the immediate (Today), the structural (Planning), and the conceptual (Thinking).

---

## 💎 The Three Pillars

### 1. The Workspace (Action)
A high-fidelity environment for managing the movement of your day.
- **Dynamic Dashboard:** A focused view of daily priorities and progress.
- **Intelligent Tasking:** Advanced priority levels, subtask nesting, and a powerful recurrence engine (Daily, Weekly, Monthly).
- **Multi-Dimensional Planning:** Switch between a **Monthly Calendar** for deadlines and a **Kanban Board** for workflow management.
- **Task Master:** A built-in "seed" generator to instantly populate your workspace for testing and layout.

### 2. The Second Brain (Intelligence)
A connected knowledge base that evolves as you think.
- **Virtual Folders:** Organize notes into custom categories to prevent information overload.
- **Weighted Global Search:** A high-performance engine that indexes titles, folder names, and content with relevance-based ranking.
- **Bidirectional Linking:** Use `[[Wiki-Links]]` to connect ideas. The **Back-link Panel** automatically tracks every note that references the current one.
- **The Branch Graph:** A live, interactive visual map of your knowledge. Navigate your thoughts spatially and discover hidden connections.

### 3. The Data Fortress (Ownership)
Your life is private. LifeFlow ensures it stays that way.
- **Local-First Architecture:** All data is stored directly in your browser. No accounts, no cloud syncing, and no third-party tracking.
- **The Master Archive:** A one-click snapshot of your entire existence—tasks, notes, folders, and preferences—exported as a single portable file.
- **The Validation Gate:** A secure import pipeline that verifies archive integrity and versioning before restoration.
- **AES-256 Encryption:** Option to protect your backups with military-grade encryption via the Web Crypto API, ensuring your archives are readable only by you.

---

## 🏗️ Technical Architecture

LifeFlow has evolved from a monolithic prototype into a decoupled, modular ecosystem.

- **State Management:** A centralized `StateManager` using the Store pattern. It handles deep-cloned state access, debounced persistence, and a subscription-based update system to ensure surgical DOM re-renders.
- **Modular Design:** Business logic is split into dedicated modules (`auth.js`, `tasks.js`, `notes.js`, `theme.js`, `ui.js`), preventing regressions and enabling rapid feature extension.
- **Rendering Pipeline:** A modular orchestrator that manages view transitions and implements section-level error boundaries to prevent total application failure.

### Tech Stack
| Area | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Custom Properties, Grid, Flexbox), Modular JavaScript (ES6+) |
| **Markdown** | Marked.js (Parsing), DOMPurify (Sanitization) |
| **Visualization** | Mermaid.js (Diagrams), Custom SVG Graph Engine |
| **Security** | Web Crypto API (AES-256-GCM, PBKDF2), DOMPurify |
| **Storage** | Browser Local Storage / IndexedDB |
| **Hosting / CI** | GitHub Pages, GitHub Actions |

---

## 🧭 Brand Identity

LifeFlow is represented by the **Compass Mark**: a four-point cyan-teal compass star inside a segmented circular ring. It symbolizes direction, clarity, balance, and purposeful progress. This mark is consistently applied across the landing page, login terminal, and workspace.

The primary vector asset is located at `Updated/compass-mark.svg`.

---

## 🚀 Getting Started

### Requirements
- A modern web browser (Chrome, Firefox, Safari, or Edge).
- An internet connection for CDN-hosted libraries (Fonts, Marked, Mermaid).

### Run Locally
1. Clone the repository.
2. From the root directory, start a local server:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser to: `http://localhost:8000/Updated/`

---

## 🛡️ Data & Privacy

LifeFlow is designed for absolute privacy. 
- **No Servers:** Your data never leaves your device.
- **No Tracking:** No analytics or telemetry are implemented.
- **Ownership:** You own your data. Use the **Master Archive** feature to keep regular backups, as clearing browser site data will remove your local information.

---

## 🤝 Contributing

LifeFlow is an open-source project. Bug reports and feature suggestions are welcome via GitHub Issues. When contributing:
1. Make all application changes in the `Updated/` directory.
2. Ensure new features are integrated into the modular state system.
3. Verify that no regressions are introduced to the core "Flow" experience.

---

## 📜 License

LifeFlow is distributed under the [MIT License](https://opensource.org/licenses/MIT).

---

## ✉️ Contact

- **GitHub:** [@BrightShadow0](https://github.com/BrightShadow0)
- **Email:** turingtestdummy1@gmail.com
- **Repository:** [BrightShadow0/LifeFlow](https://github.com/BrightShadow0/LifeFlow)
