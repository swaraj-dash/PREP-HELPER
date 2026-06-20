# Prep Helper — Ultimate AI-Powered Preparation Dashboard

Prep Helper is a premium, localized, AI-powered study companion and preparation dashboard. Designed with a sleek slate-glass dark HSL theme, it helps candidates master complex concepts (like the **Claude Certified AI Architect** syllabus) through automated document ingestion, semantic tagging, AI-generated questions, spaced repetition (SM-2 SRS), and local encrypted vault storage.

---

## 🌟 Key Features

- **📂 Multi-Format Ingestion:** Seamless PDF and Markdown parser that normalizes headings, auto-classifies content focus (QA-heavy vs. Notes-heavy), and breaks content into semantic chunks.
- **🏷️ Automated & Custom Tagging:** Matches text chunks with a comprehensive, seed-configured 200-tag computer science vocabulary while supporting inline additions and duplicate merging.
- **🧠 Spaced Repetition (SRS):** An interactive flashcard engine running the SM-2 algorithm to schedule reviews based on self-rated difficulty (Again, Hard, Good, Easy) with responsive swipe-gesture reviews.
- **📊 Activity Analytics:** Interactive SVG heatmaps, daily streak track logs, weak-area analytics, and domain topic coverage matrices.
- **🔒 Portable Encrypted Vaults:** Export and import selected sections under secure AES-256-GCM passphrase protection with interactive collision-resolution controls (`Keep Mine`, `Keep Theirs`, `Keep Both`).
- **📱 Responsive Layout:** Optimized navigation with collapsing sidebars on tablet viewports and custom bottom action bars on mobile screen sizes.

---

## 🛠️ Prerequisites

Before launching Prep Helper, ensure you have the following installed on your machine:
- **Python:** 3.11 or later
- **Node.js:** 18.x or later (along with `npm`)
- **Docker & Docker Compose** (Optional: only if running via containerization)

---

## 🚀 Getting Started

The app is packaged with an automated Python launcher that configures virtual environments, installs packages, compiles production assets, starts the server, and loads your default browser automatically.

### 1. Standard Startup

Clone this repository to your local drive and execute the launch wrapper matching your operating system:

#### **On Windows (Command Prompt or PowerShell):**
```cmd
.\prep-helper\start.bat
```

#### **On macOS / Linux (Terminal):**
```bash
chmod +x ./prep-helper/start.sh
./prep-helper/start.sh
```

*To force a rebuild of the React frontend, pass the `--rebuild` flag:*
```bash
./prep-helper/start.sh --rebuild
```

### 2. Startup via Docker

If you prefer running in a container without installing local python packages:
```bash
cd prep-helper
docker compose up --build
```
Open `http://localhost:8765` in your browser. The default compose configuration mounts a `./vault` directory in the project folder to safely store database files.

---

## 📋 First-Run Guide

1. **Initialize Your Vault:**
   Upon loading the dashboard for the first time, you will be greeted by the Welcome Wizard. Choose or input an absolute path on your host machine to serve as your local Vault directory (e.g. `C:\Users\username\prephelper-vault` or `/home/user/prephelper-vault`).
2. **Setup API Credentials:**
   Navigate to the **Settings** page. Enter API keys for your preferred LLM providers (Google Gemini, OpenAI, or Groq) and configure model preference defaults. Click **Test API Key** to verify connectivity.
3. **Upload Material:**
   Go to the **Upload** page, drop your study guides, slides, syllabus documents, or notes PDFs. Watch the pipeline extract, classify, tag, embed, and compile questions in real time.
4. **Start Learning:**
   Review questions in the **Question Bank**, read merged outlines in **Study Notes**, review active decks in **Flashcards**, and trace your knowledge metrics on the **Dashboard** heatmap.

---

## ❓ FAQ

### Q: Where is my data stored?
All files, database states, logs, and vector indexes are stored locally in the absolute vault path directory you configure during setup. No study materials or credentials leave your machine except when calling configured AI APIs.

### Q: How do I transfer my vault to another computer?
1. Zip/archive your vault folder and copy it to the new machine.
2. Launch Prep Helper on the new machine, and set the absolute path to this copied folder.
3. Alternatively, use the **Vault Tools** page to export tag-specific packages as encrypted `.phvault` files and import them on your target machine.

### Q: What happens if I forget my export passphrase?
Export packages are encrypted using AES-256-GCM. Because Prep Helper runs purely locally without cloud server recovery databases, forgotten passphrases **cannot** be recovered. Always note down passphrases securely.

### Q: Which AI provider is recommended?
For high performance and speed, we recommend using **Groq** (with `llama-3.3-70b-versatile` or `llama3-8b-8192`) or **Google Gemini** (`gemini-1.5-pro` or `gemini-1.5-flash`). You can switch providers dynamically on the **Settings** page.

---

## 📸 Screenshots

*Below are placeholders for the visual panels. Run the app locally to experience the live micro-interactions:*

#### 📊 Ultimate Study Dashboard
![Dashboard View](file:///d:/Projects/PREP%20HELPER/prep-helper/frontend/src/assets/placeholder-dashboard.png)

#### 📝 Sequential Study Notes (Merged Focus Mode)
![Study Notes View](file:///d:/Projects/PREP%20HELPER/prep-helper/frontend/src/assets/placeholder-notes.png)

#### ⚡ SM-2 Flashcard review (3D Flip Card Deck)
![Flashcard View](file:///d:/Projects/PREP%20HELPER/prep-helper/frontend/src/assets/placeholder-flashcards.png)

---

## 📁 Repository Structure

```
prep-helper/
├── backend/               # FastAPI application, database schemas, pipeline tasks
│   ├── models/            # SQLAlchemy database models
│   ├── routers/           # REST endpoints & WebSockets
│   ├── schemas/           # Pydantic serialization models
│   ├── services/          # SRS algorithm, progress engines, AI client
│   └── utils/             # Crypto modules, config parsers, tag seed vocabulary
├── frontend/              # Vite React web application
│   ├── src/
│   │   ├── components/    # Reusable components & skeletons
│   │   ├── pages/         # Dashboard, Upload, Flashcards, Settings, etc.
│   │   └── stores/        # Zustand application store
├── Dockerfile             # Multi-stage container assembly config
├── docker-compose.yml     # Local compose config
├── launcher.py            # Automated system launcher core
├── start.sh               # Unix start wrapper
└── start.bat              # Windows start wrapper
```
