# LifeFlow
**Make room for what matters.**

[![Source-Available License](https://img.shields.io/badge/License-Source--Available-orange.svg)](./LICENSE)

LifeFlow is a local-first productivity workspace designed to reduce digital noise and help people manage their attention, not just their to-do lists. It brings task management, planning, calendars, and a connected knowledge base into one calm workspace.

**© 2026 BrightShadow0. All rights reserved.**

---

## 🌿 The Philosophy: Calm Productivity

Most productivity tools are designed for capture: they are loud, notification-driven, and demanding. LifeFlow is designed for **clarity**.

Your digital workspace should be a sanctuary, not another source of stress. LifeFlow brings together the immediate (Today), the structural (Planning), and the conceptual (Thinking) in one connected environment.

---

## 💎 The Three Pillars

### 1. The Workspace (Action)
A focused environment for managing the movement of your day.
- **Today Dashboard:** A focused view of daily priorities, progress, and upcoming calendar events.
- **Task Management:** Priorities, subtasks, recurring tasks, and task organisation.
- **Calendar:** Month and agenda views for planning dates and events.
- **Kanban:** A visual workflow for actionable tasks.
- **Task Master:** A seed-data tool for populating the workspace during testing.

### 2. The Second Brain (Intelligence)
A connected knowledge base that evolves as you think.
- **Virtual Folders:** Organise notes into custom categories.
- **Global Search:** Search across note titles, folders, and content.
- **Wiki-Links and Backlinks:** Connect related notes and see references to the note you're viewing.
- **Branch Graph:** Explore connections in your knowledge through an interactive visual map.
- **Markdown and Diagrams:** Write structured notes and create Mermaid diagrams.

### 3. The Data Fortress (Ownership)
LifeFlow is designed around user control and local-first storage.
- **Local-First by Default:** Core workspace data is stored locally in the browser.
- **Portable Archives:** Export and restore supported workspace data.
- **Encrypted Backups:** Protect supported backup archives with AES-GCM encryption using the Web Crypto API.
- **Optional Cloud Services:** Cloud accounts, encrypted backups, and multi-device features are optional and depend on the configured deployment.
- **Selective Sharing:** Supported shared-calendar features let users choose what to publish. Shared event data is not end-to-end encrypted; review the privacy implications before publishing.

---

## 🏗️ Technical Architecture

LifeFlow has evolved from a monolithic prototype toward a more modular application architecture.

- **State Management:** A central state layer coordinates workspace data and persistence.
- **Modular Design:** Application responsibilities are separated across authentication, task, notes, theme, and UI modules.
- **Rendering:** View updates are organised to limit unnecessary re-rendering and isolate failures.
- **Security:** Browser cryptography is used for supported encrypted backup workflows. Cloud security also depends on the deployed backend, its configuration, and the implementation of each cloud feature.

### Tech Stack

| Area | Technology |
| :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) |
| **Markdown** | Marked.js, DOMPurify |
| **Visualisation** | Mermaid.js, custom SVG graph engine |
| **Security** | Web Crypto API (AES-GCM, PBKDF2), DOMPurify |
| **Storage** | Browser storage; cloud services for explicitly enabled features |
| **Hosting / CI** | GitHub Pages, GitHub Actions |

---

## 🧭 Brand Identity

LifeFlow is represented by the **Compass Mark**: a four-point cyan-teal compass star inside a segmented circular ring. It symbolises direction, clarity, balance, and purposeful progress.

The primary vector asset is located at `Updated/compass-mark.svg`.

---

## 🚀 Getting Started

### Requirements
- A modern web browser (Chrome, Firefox, Safari, or Edge).
- An internet connection for CDN-hosted libraries and any cloud services you choose to use.

### Run Locally
1. Clone or download the repository for inspection and permitted personal evaluation.
2. From the root directory, start a local server:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000/Updated/` in your browser.

Use of the source code is subject to the [LifeFlow Source-Available License](./LICENSE). Public visibility does not mean the project is open source or that unrestricted reuse is permitted.

---

## 🛡️ Data & Privacy

LifeFlow follows a **local-first, private-by-default** approach. Core workspace data is stored in the browser. Optional cloud capabilities are separate and require the relevant account and backend configuration.

- **Local Workspace:** Local data remains in the browser unless you explicitly use a feature that sends or publishes data.
- **Optional Cloud:** Cloud accounts, encrypted backup storage, and synchronisation are opt-in capabilities. Availability depends on the deployed backend and configuration.
- **Encrypted Backups:** Supported backup workflows use encryption. Keep your passphrase safe; it may be required to restore an archive.
- **Selective Sharing:** Only information deliberately published through supported sharing features should be shared. Shared calendar event data is not end-to-end encrypted.
- **Your Responsibility:** Export regular backups. Clearing browser site data can remove locally stored information.

No privacy or security claim should be read as a guarantee that every deployment, integration, or shared-data workflow has identical protections. Review the relevant feature settings before enabling cloud storage or sharing.

---

## 🤝 Feedback

LifeFlow is source-available, not an open-source project. Bug reports and feature suggestions are welcome through GitHub Issues. Submitting feedback does not grant permission to copy, modify, redistribute, or commercially exploit the LifeFlow source code.

---

## 📜 License

LifeFlow is **source-available under a proprietary, non-commercial licence**. The source is publicly visible for inspection and permitted personal or educational evaluation. All rights not expressly granted are reserved by the copyright owner.

Commercial use, redistribution, sublicensing, and use of the code in competing products are not permitted without prior written permission. Read the complete [LICENSE](./LICENSE) before using the source.

The licence applies to LifeFlow-owned material. Third-party libraries and assets remain subject to their respective licences and notices.

---

## ✉️ Contact

- **GitHub:** [@BrightShadow0](https://github.com/BrightShadow0)
- **Email:** turingtestdummy1@gmail.com
- **Repository:** [BrightShadow0/LifeFlow](https://github.com/BrightShadow0/LifeFlow)
