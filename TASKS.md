# PREP HELPER — Agent Task Tickets

> **How to use this file:**
> Work through tasks top to bottom, one at a time. Check off each task `[x]` before moving to the next.
> Never skip ahead to a later phase — each phase depends on the previous being fully working.
> If a task says "verify", actually run the code and confirm the output before continuing.
> Reference `PROJECT.md` for full specs on anything abbreviated here.

---

## PHASE 0 — Foundation

> Goal: A running FastAPI server + React app + working database + vault setup + settings page.
> Done when: You can open the app in a browser, go through first-run setup, enter an API key, and see it saved.

---

### TASK-001 — Initialise repo structure

- [ ] Create root folder `prep-helper/`
- [ ] Create all directories as defined in PROJECT.md §12 (File Structure):
  - `backend/models/`, `backend/schemas/`, `backend/routers/`, `backend/services/pipeline/`, `backend/migrations/versions/`, `backend/utils/`
  - `frontend/src/pages/`, `frontend/src/components/ui/`, `frontend/src/hooks/`, `frontend/src/stores/`, `frontend/src/api/`, `frontend/src/utils/`
- [ ] Create empty `__init__.py` in every `backend/` subdirectory
- [ ] Create `.env.example` with contents:
  ```
  VAULT_PATH=/path/to/your/vault
  PORT=8765
  ```
- [ ] Create `.gitignore` covering: `__pycache__/`, `*.pyc`, `.env`, `node_modules/`, `dist/`, `vault/`, `~/.prephelper/`
- [ ] **Verify:** `find prep-helper -type d` shows the full tree with no missing folders

---

### TASK-002 — Backend: Python environment + dependencies

- [ ] Create `backend/requirements.txt` with exact contents from PROJECT.md §14
- [ ] Create a Python virtual environment: `python -m venv venv`
- [ ] Install dependencies: `pip install -r backend/requirements.txt`
- [ ] **Verify:** `python -c "import fastapi, sqlalchemy, chromadb, markitdown; print('OK')"` prints `OK`

---

### TASK-003 — Backend: Config system (`config.py`)

- [ ] Create `backend/config.py`
- [ ] Implement `AppConfig` class using `pydantic-settings`:
  - Fields: `port: int = 8765`, `vault_path: str | None = None`, `api_keys: dict = {}`, `model_prefs: dict = {}`
- [ ] Implement `load_config() -> AppConfig`:
  - Reads from `~/.prephelper/config.json` if it exists
  - Returns defaults if file missing
- [ ] Implement `save_config(config: AppConfig)`:
  - Creates `~/.prephelper/` dir if missing
  - Backs up existing config to `config.json.bak` before overwriting
  - Writes updated config as JSON
- [ ] Implement `is_vault_configured() -> bool`: returns `True` if `vault_path` is set and the directory exists
- [ ] Implement `init_vault(path: str)`:
  - Creates `vault/uploads/`, `vault/exports/`, `vault/db/`, `vault/chroma/`, `vault/logs/`
  - Writes `vault/.prephelper_meta.json` with `{ "version": "1.0", "created_at": "<ISO timestamp>", "schema_version": 1 }`
- [ ] **Verify:** Call `init_vault("/tmp/test-vault")` and confirm all subdirs are created

---

### TASK-004 — Backend: Database setup (`database.py`)

- [ ] Create `backend/database.py`
- [ ] Set up SQLAlchemy async engine pointing to `{vault_path}/db/prephelper.sqlite`
- [ ] Create `SessionLocal` factory using `AsyncSession`
- [ ] Create `Base = declarative_base()`
- [ ] Implement `get_db()` async dependency (FastAPI-compatible)
- [ ] Implement `init_db()` async function that creates all tables if they don't exist
- [ ] **Verify:** `asyncio.run(init_db())` runs without error against a temp vault path

---

### TASK-005 — Backend: SQLAlchemy models

Create one file per model in `backend/models/`. Each must match the schema in PROJECT.md §8 exactly.

- [ ] `models/document.py` — `Document` model with all columns from schema
- [ ] `models/question.py` — `Question` model
- [ ] `models/note.py` — `Note` model
- [ ] `models/tag.py` — `Tag` model + `ItemTag` association model
- [ ] `models/srs.py` — `SRSCard` + `SRSReview` + `StudySession` + `UserAnnotation` models
- [ ] `models/__init__.py` — imports all models so Alembic can discover them
- [ ] Add all indexes defined in PROJECT.md §8 (end of schema section)
- [ ] **Verify:** `from backend.models import Document, Question, Note, Tag, ItemTag, SRSCard` imports without error

---

### TASK-006 — Backend: Alembic migration setup

- [ ] Run `alembic init backend/migrations`
- [ ] Edit `migrations/env.py`:
  - Import `Base` from `backend.database`
  - Set `target_metadata = Base.metadata`
  - Configure SQLite URL from vault path (use env var `VAULT_PATH` for migration runs)
- [ ] Generate initial migration: `alembic revision --autogenerate -m "initial_schema"`
- [ ] Review generated migration in `migrations/versions/` — confirm all 9 tables + indexes are present
- [ ] **Verify:** `alembic upgrade head` runs cleanly and creates the SQLite file with correct schema. Run `sqlite3 db.sqlite ".tables"` to confirm all tables exist.

---

### TASK-007 — Backend: Pydantic schemas

Create `backend/schemas/` files. These are the request/response shapes for the API — separate from ORM models.

- [ ] `schemas/document.py`:
  - `DocumentUploadResponse`: `{ doc_id: str }`
  - `DocumentSummary`: `{ id, original_name, status, doc_type, uploaded_at, question_count, note_count, tag_summary }`
  - `DocumentDetail`: extends `DocumentSummary` with `page_count, chunk_count, error_message`
- [ ] `schemas/question.py`:
  - `QuestionOut`: all fields + `tags: list[TagOut]` + `srs_state: SRSStateOut | None`
  - `QuestionPatch`: `{ question_text?, answer_text?, bookmarked?, add_tags?: list[str], remove_tags?: list[str] }`
- [ ] `schemas/note.py`:
  - `NoteOut`: all fields + `tags: list[TagOut]` + `source_doc_name: str`
  - `NotePatch`: `{ content?, add_tags?, remove_tags? }`
- [ ] `schemas/tag.py`:
  - `TagOut`: `{ id, name, tag_type, usage_count }`
  - `TagCreate`: `{ name, tag_type: "custom" }`
  - `TagMerge`: `{ source_tag_id: str, target_tag_id: str }`
- [ ] `schemas/srs.py`:
  - `SRSStateOut`: `{ ease_factor, interval_days, due_date, repetitions }`
  - `ReviewSubmit`: `{ question_id: str, rating: Literal["again","hard","good","easy"], response_time_ms?: int }`
  - `SessionStart`: `{ tag_filter?: list[str], session_type?: str }`
- [ ] **Verify:** All schemas import cleanly with `from backend.schemas import *`

---

### TASK-008 — Backend: FastAPI main app (`main.py`)

- [ ] Create `backend/main.py`
- [ ] Instantiate `FastAPI(title="Prep Helper", version="1.0.0")`
- [ ] Add CORS middleware: allow `http://localhost:5173` (Vite dev) and `http://localhost:8765`
- [ ] Add startup event handler:
  - Load config
  - If vault is configured, call `init_db()`
  - Log startup message with port and vault path
- [ ] Mount a placeholder router at `/api` (empty for now — routers added in later tasks)
- [ ] Add a catch-all route that serves `frontend/dist/index.html` for all non-API routes (for production mode where React is built)
- [ ] Add `GET /api/health` endpoint returning `{ "status": "ok", "vault_configured": bool, "version": "1.0.0" }`
- [ ] **Verify:** `uvicorn backend.main:app --port 8765 --reload` starts without error. `curl http://localhost:8765/api/health` returns `{"status":"ok",...}`

---

### TASK-009 — Backend: Settings router (`routers/settings.py`)

- [ ] Create `backend/routers/settings.py`
- [ ] `GET /api/settings`:
  - Returns current config; mask API keys as `"***"` in response
  - Include: `vault_path`, `vault_configured`, `model_prefs`, `providers_configured: list[str]`
- [ ] `POST /api/settings`:
  - Accepts full settings payload
  - Encrypt API keys using `utils/crypto.py` (implement a simple symmetric encrypt with a machine-specific key derived from machine UUID or hostname) before storing
  - Save via `save_config()`
  - Return updated settings (keys masked)
- [ ] `POST /api/settings/test-key`:
  - Accepts `{ provider: str, api_key: str, model?: str }`
  - Makes a minimal API call to the provider (e.g. list models or a tiny completion)
  - Returns `{ valid: bool, error?: str }`
- [ ] `POST /api/vault/setup`:
  - Accepts `{ vault_path: str }`
  - Validates path is absolute and writable
  - Calls `init_vault(path)`
  - Saves vault_path to config
  - Calls `init_db()` to create tables in new vault
  - Returns `{ success: bool, vault_path: str }`
- [ ] Register router in `main.py`
- [ ] **Verify:** POST to `/api/vault/setup` with a real path creates the vault folder structure

---

### TASK-010 — Backend: Crypto utility (`utils/crypto.py`)

- [ ] Create `backend/utils/crypto.py`
- [ ] Implement `get_machine_key() -> bytes`:
  - Derives a 32-byte key from `platform.node()` (hostname) using PBKDF2-HMAC-SHA256 with a fixed salt
  - This key is used to encrypt API keys at rest in config (not vault exports — those use user passphrase)
- [ ] Implement `encrypt_string(plaintext: str) -> str`: AES-256-GCM, returns base64-encoded `nonce + ciphertext + tag`
- [ ] Implement `decrypt_string(ciphertext_b64: str) -> str`: reverses above
- [ ] Implement `derive_key_from_passphrase(passphrase: str, salt: bytes) -> bytes`: PBKDF2-HMAC-SHA256, 600,000 iterations (for vault export/import)
- [ ] Implement `encrypt_vault_payload(data: bytes, passphrase: str) -> tuple[bytes, bytes, bytes]`: returns `(ciphertext, nonce, salt)`
- [ ] Implement `decrypt_vault_payload(ciphertext: bytes, nonce: bytes, salt: bytes, passphrase: str) -> bytes`
- [ ] **Verify:** Round-trip test: `assert decrypt_string(encrypt_string("hello")) == "hello"` passes

---

### TASK-011 — Frontend: React + Vite scaffold

- [ ] `cd frontend && npm create vite@latest . -- --template react`
- [ ] Install all dependencies from PROJECT.md §14 frontend list:
  ```
  npm install react-router-dom axios zustand react-dropzone framer-motion recharts react-hot-toast lucide-react @tanstack/react-query @headlessui/react
  npm install -D tailwindcss autoprefixer postcss @vitejs/plugin-react
  ```
- [ ] Init Tailwind: `npx tailwindcss init -p`
- [ ] Configure `tailwind.config.js` content paths: `["./index.html", "./src/**/*.{js,jsx}"]`
- [ ] Add Tailwind directives to `src/index.css`
- [ ] Configure `vite.config.js` with dev proxy:
  ```js
  server: { proxy: { '/api': 'http://localhost:8765', '/ws': { target: 'ws://localhost:8765', ws: true } } }
  ```
- [ ] **Verify:** `npm run dev` starts on port 5173 with no errors. App renders default Vite page.

---

### TASK-012 — Frontend: Routing + layout shell (`App.jsx`)

- [ ] Create `src/App.jsx` with `react-router-dom` v6 `BrowserRouter` + `Routes`
- [ ] Define routes for all pages (stub components for now — just return `<div>Page Name</div>`):
  - `/` → `Dashboard`
  - `/upload` → `Upload`
  - `/questions` → `QuestionBank`
  - `/notes` → `StudyNotes`
  - `/flashcards` → `Flashcards`
  - `/progress` → `Progress`
  - `/tags` → `TagManager`
  - `/documents` → `Documents`
  - `/vault` → `VaultTools`
  - `/settings` → `Settings`
- [ ] Create a `Sidebar` component with nav links to all pages using lucide-react icons
- [ ] Create a `Layout` component: sidebar left + main content right
- [ ] Wrap app with `QueryClientProvider` (React Query) and `Toaster` (react-hot-toast)
- [ ] **Verify:** `npm run dev`, click all nav links, each shows the correct stub page name

---

### TASK-013 — Frontend: Global state store (`stores/appStore.js`)

- [ ] Create `src/stores/appStore.js` using Zustand
- [ ] State shape:
  ```js
  {
    vaultConfigured: false,
    vaultPath: null,
    activeProvider: null,       // 'gemini' | 'groq' | 'openai'
    activeModel: null,
    providersConfigured: [],
    setVaultConfigured: (bool) => ...,
    setSettings: (settings) => ...,
  }
  ```
- [ ] On app mount (`App.jsx`), fetch `GET /api/settings` and populate store
- [ ] If `vault_configured: false`, redirect to `/settings` with a first-run banner

---

### TASK-014 — Frontend: API client (`api/client.js`)

- [ ] Create `src/api/client.js`
- [ ] Create Axios instance with `baseURL: '/api'` and `Content-Type: application/json`
- [ ] Add response interceptor: on any error response, show a toast with `error.response.data.error.message`
- [ ] Export typed async functions for all endpoints used in Phase 0:
  ```js
  export const getSettings = () => api.get('/settings')
  export const saveSettings = (data) => api.post('/settings', data)
  export const testApiKey = (data) => api.post('/settings/test-key', data)
  export const setupVault = (vault_path) => api.post('/vault/setup', { vault_path })
  export const getHealth = () => api.get('/health')
  ```
- [ ] **Verify:** In browser console: `import('/api/client.js').then(m => m.getHealth().then(console.log))` returns health response

---

### TASK-015 — Frontend: Settings page (`pages/Settings.jsx`)

- [ ] Build the full Settings page UI:
  - **Vault section**: text input for vault path + "Setup Vault" button. Shows green checkmark + current path if already configured.
  - **API Keys section**: Three provider cards (Gemini, Groq, OpenAI). Each has: API key input (password type), model dropdown (hardcoded options per provider), "Test Key" button that calls `/api/settings/test-key` and shows ✅ or ❌
  - **Save button**: calls `POST /api/settings` with all values, shows success toast
- [ ] Populate form from `GET /api/settings` on mount (keys show as `***` if set)
- [ ] On vault setup success: update Zustand store, show toast "Vault ready at {path}"
- [ ] **Verify:** Full flow: enter a real Groq API key, click Test → see ✅. Click Save → reload page → key still shown as `***` (meaning it persisted)

---

### TASK-016 — Frontend: First-run experience

- [ ] If `vault_configured: false` when app loads (from store):
  - Show a full-screen welcome modal/overlay (not dismissable) with app name, tagline, and "Get Started" button
  - "Get Started" scrolls to / navigates to Settings page
  - Modal should not show on subsequent visits once vault is configured
- [ ] Add an empty state to Dashboard for when vault is fresh:
  - "No documents yet. Upload your first PDF to get started." with a button linking to `/upload`
- [ ] **Verify:** Delete `~/.prephelper/config.json`, reload app → welcome screen appears. Set up vault → welcome screen gone on next load.

---

### PHASE 0 COMPLETION CHECK

Before moving to Phase 1, confirm ALL of the following:

- [ ] `python launcher.py` (or `uvicorn backend.main:app`) starts without errors
- [ ] `GET /api/health` returns `{ status: "ok", vault_configured: true }`
- [ ] `npm run dev` (frontend) shows the app with sidebar navigation
- [ ] All 10 pages render (even as stubs) without console errors
- [ ] Settings page: vault path can be set, API key can be tested and saved
- [ ] Config persists across server restarts (reload backend, settings still there)
- [ ] SQLite file exists at `{vault_path}/db/prephelper.sqlite` with all 9 tables
- [ ] Vault folder structure exists with all subdirectories

---

## PHASE 1 — Ingestion Pipeline

> Goal: Upload a PDF and have it fully processed — extracted, classified, chunked, tagged, embedded — with real-time progress in the UI.
> Done when: Upload a real Q&A PDF → see pipeline stages complete → questions appear in DB.

---

### TASK-101 — Backend: Tag vocabulary seed (`utils/tag_vocab.py`)

- [ ] Create `backend/utils/tag_vocab.py`
- [ ] Define `TAG_VOCABULARY: list[dict]` with ~200 tags covering:
  - **AI/ML:** LangChain, LangGraph, RAG, Vector Database, Embeddings, Fine-tuning, Prompt Engineering, Agents, Function Calling, Multimodal, Transformers, Attention Mechanism, RLHF, Federated Learning, ChromaDB, Pinecone, Ollama, OpenAI, Gemini, Groq, HuggingFace
  - **Backend:** FastAPI, Django, Flask, REST API, GraphQL, WebSocket, gRPC, Authentication, JWT, OAuth, Redis, Celery, Docker, Kubernetes, Nginx
  - **Frontend:** React, Vue, Angular, TypeScript, JavaScript, TailwindCSS, State Management, React Query, Zustand, Redux
  - **Databases:** SQL, PostgreSQL, MySQL, SQLite, MongoDB, SQLAlchemy, Alembic, Indexing, Query Optimization
  - **DevOps:** CI/CD, GitHub Actions, Docker Compose, AWS, GCP, Azure, Terraform, Monitoring
  - **CS Fundamentals:** Data Structures, Algorithms, Time Complexity, Dynamic Programming, Graph Theory, System Design, Distributed Systems, Caching, Load Balancing, CAP Theorem
  - **Testing:** Unit Testing, Integration Testing, E2E Testing, TDD, Pytest, Selenium, Playwright
  - Each entry: `{ "name": "LangGraph", "tag_type": "tech" }`
- [ ] Implement `seed_tags(db_session)`: inserts all vocabulary tags into `tags` table if they don't already exist
- [ ] Call `seed_tags()` from `init_db()` in `database.py`
- [ ] **Verify:** After `init_db()`, `SELECT COUNT(*) FROM tags` returns ~200

---

### TASK-102 — Backend: AI client (`services/ai_client.py`)

- [ ] Create `backend/services/ai_client.py`
- [ ] Implement `AIClient` class:
  ```python
  class AIClient:
      def __init__(self, provider: str, model: str, api_key: str): ...
      async def complete(self, system: str, user: str, json_mode: bool = True) -> str: ...
      async def embed(self, texts: list[str]) -> list[list[float]]: ...
  ```
- [ ] `complete()` routes to:
  - `"gemini"` → `langchain_google_genai.ChatGoogleGenerativeAI`
  - `"groq"` → `langchain_groq.ChatGroq`
  - `"openai"` → `langchain_openai.ChatOpenAI`
- [ ] `embed()` routes to appropriate embedding model per provider
- [ ] `complete()` must: retry up to 3 times with exponential backoff on rate-limit errors (HTTP 429)
- [ ] Implement `get_ai_client() -> AIClient`: reads active provider/model/key from config, decrypts key, returns client instance
- [ ] **Verify:** `await client.complete("You are helpful", "Say hello in JSON: {\"greeting\": ...}")` returns valid JSON string

---

### TASK-103 — Backend: File extractor (`services/pipeline/extractor.py`)

- [ ] Create `backend/services/pipeline/extractor.py`
- [ ] Implement `extract_to_markdown(file_path: str) -> tuple[str, int]`:
  - Try MarkItDown first: `from markitdown import MarkItDown; md = MarkItDown(); result = md.convert(file_path)`
  - If result text < 200 chars OR raises exception → fall back to PyMuPDF
  - PyMuPDF fallback: `import fitz; doc = fitz.open(file_path); text = "\n\n".join(page.get_text() for page in doc)`
  - Return `(markdown_text, page_count)`
- [ ] Implement `clean_markdown(text: str) -> str`:
  - Remove repeated blank lines (max 2 consecutive)
  - Strip control characters
  - Fix common encoding artifacts
- [ ] **Verify:** Pass a real PDF path → get back non-empty markdown string and correct page count

---

### TASK-104 — Backend: Document classifier (`services/pipeline/classifier.py`)

- [ ] Create `backend/services/pipeline/classifier.py`
- [ ] Implement `classify_document(text: str, ai_client: AIClient) -> dict`:
  - Send first 2000 chars to LLM with prompt from PROJECT.md §9.1 Stage 2
  - Parse JSON response: `{ "type": "QA_HEAVY"|"NOTES_HEAVY"|"MIXED", "confidence": float, "qa_ratio": float }`
  - If JSON parse fails: default to `"MIXED"` with confidence 0.5
  - Return the dict
- [ ] **Verify:** Pass a clearly Q&A-formatted text → get `type: "QA_HEAVY"`

---

### TASK-105 — Backend: Content chunker (`services/pipeline/chunker.py`)

- [ ] Create `backend/services/pipeline/chunker.py`

**Q&A Chunker:**
- [ ] Implement `chunk_qa_regex(text: str) -> list[dict]`: tries these patterns in order:
  - Pattern A: `Q: ...\nA: ...`
  - Pattern B: `**Q:** ... **A:** ...` (bold markdown)
  - Pattern C: Numbered `1. Question?\nAnswer:` blocks
  - Returns `[{ "q": str, "a": str, "page_ref": None }]`
- [ ] Implement `chunk_qa_llm(text: str, ai_client: AIClient) -> list[dict]`:
  - For texts where regex finds < 3 pairs
  - Use prompt from PROJECT.md §9.1 Stage 3a
  - Process in chunks of ~3000 chars with overlap to not miss pairs at boundaries
  - Parse and return same shape as above

**Notes Chunker:**
- [ ] Implement `chunk_notes(text: str) -> list[dict]`:
  - Split at `#`, `##`, `###` heading boundaries
  - If any chunk > 500 tokens (approx 2000 chars): split further at double newlines
  - Each chunk: `{ "heading": str, "content": str, "position": int }`
  - Inherit nearest parent heading if splitting a large section

- [ ] Implement `chunk_document(text: str, doc_type: str, ai_client: AIClient) -> tuple[list, list]`:
  - Returns `(qa_chunks, note_chunks)` based on doc_type
  - For MIXED: run both chunkers
  - For QA_HEAVY: only QA chunker, empty notes list
  - For NOTES_HEAVY: only notes chunker, empty qa list

- [ ] **Verify:** Pass a 10-question Q&A text through `chunk_qa_regex()` → get list of 10 dicts

---

### TASK-106 — Backend: Tagger (`services/pipeline/tagger.py`)

- [ ] Create `backend/services/pipeline/tagger.py`
- [ ] Implement `tag_chunks(chunks: list[dict], chunk_type: str, ai_client: AIClient, db_session) -> list[dict]`:
  - `chunk_type` is `"qa"` or `"note"`
  - Process in batches of 10 chunks per LLM call
  - Use prompt from PROJECT.md §9.1 Stage 4
  - Include top 80 tag names from `TAG_VOCABULARY` in system prompt
  - Each chunk gets back: `{ "id": idx, "tags": [str], "difficulty": str }`
  - For each returned tag name: find or create in `tags` table (upsert by name)
  - Return chunks with `tags` field added
- [ ] Handle LLM returning tag names not in vocabulary: create them with `tag_type: "concept"`
- [ ] **Verify:** Pass 3 LangGraph Q&A pairs → returned chunks have tags including "LangGraph"

---

### TASK-107 — Backend: Embedder (`services/pipeline/embedder.py`)

- [ ] Create `backend/services/pipeline/embedder.py`
- [ ] On module load, initialise ChromaDB client: `chromadb.PersistentClient(path="{vault_path}/chroma")`
- [ ] Get or create two collections: `"questions"` and `"notes"`
- [ ] Implement `embed_questions(questions: list[Question], ai_client: AIClient)`:
  - For each question: text = `f"Q: {q.question_text}\nA: {q.answer_text}"`
  - Batch embed (10 at a time to respect rate limits)
  - Upsert to `"questions"` collection with metadata: `{ "doc_id": str, "tags": json, "difficulty": str }`
- [ ] Implement `embed_notes(notes: list[Note], ai_client: AIClient)`:
  - For each note: text = `f"{note.heading}\n{note.content}"`
  - Batch embed, upsert to `"notes"` collection
- [ ] Implement `rebuild_index(db_session, ai_client: AIClient)`: re-embeds all existing items (called on startup if index inconsistency detected)
- [ ] **Verify:** Embed 3 test strings, then query Chroma with a related string → correct items returned

---

### TASK-108 — Backend: Pipeline orchestrator (`services/pipeline/orchestrator.py`)

- [ ] Create `backend/services/pipeline/orchestrator.py`
- [ ] Implement `run_pipeline(doc_id: str, file_path: str, original_name: str)` as an async function
- [ ] Pipeline must update `document.status` at each stage and emit a WebSocket event (see below)
- [ ] Full sequence:
  1. Set status `"extracting"` → emit event → call `extract_to_markdown()` → store `page_count`
  2. Set status `"classifying"` → emit event → call `classify_document()` → store `doc_type`
  3. Set status `"chunking"` → emit event → call `chunk_document()` → log chunk counts
  4. Set status `"tagging"` → emit event → call `tag_chunks()` for each type → bulk insert to DB → create `ItemTag` rows → update tag `usage_count`
  5. Set status `"embedding"` → emit event → call `embed_questions()` + `embed_notes()`
  6. For each topic with >3 note chunks across >1 doc: call reorder LLM (TASK-109)
  7. Set status `"done"` → emit final event → update `question_count`, `note_count`, `tag_summary` on document
  8. On any exception: set status `"error"`, store `error_message`, emit error event
- [ ] Create SRS card for each new question inserted (insert row in `srs_cards` with defaults)
- [ ] **Verify:** Run pipeline on a real PDF end-to-end. Check DB has questions, notes, item_tags populated.

---

### TASK-109 — Backend: Note reorderer (`services/pipeline/reorder.py`)

- [ ] Create `backend/services/pipeline/reorder.py`
- [ ] Implement `reorder_notes_for_topic(tag_name: str, db_session, ai_client: AIClient)`:
  - Fetch all notes tagged with `tag_name`, ordered by `(doc_id, order_index)`
  - If count < 3 or all from same doc: skip (set `topic_order = order_index`, return)
  - Build payload of `{ id, heading, content_preview (first 200 chars) }` for each note
  - Call LLM with prompt from PROJECT.md §9.1 Stage 5
  - Parse returned ID list, update `topic_order` field on each note in DB
- [ ] **Verify:** Insert 5 note chunks from 2 different docs with same tag → after reorder, `topic_order` values are set and logical

---

### TASK-110 — Backend: WebSocket endpoint (`routers/ws.py`)

- [ ] Create `backend/routers/ws.py`
- [ ] Implement a connection manager:
  ```python
  class ConnectionManager:
      def __init__(self): self.active: dict[str, WebSocket] = {}
      async def connect(self, doc_id: str, ws: WebSocket): ...
      async def disconnect(self, doc_id: str): ...
      async def send(self, doc_id: str, event: dict): ...
  ```
- [ ] `WS /ws/pipeline/{doc_id}` endpoint: accepts connection, registers it, keeps alive until disconnect
- [ ] Expose `manager` instance so orchestrator can import and call `await manager.send(doc_id, event)`
- [ ] Event shape (from PROJECT.md §9.2):
  ```json
  { "stage": str, "progress": int, "message": str, "details": {} }
  ```
- [ ] Register WebSocket router in `main.py`
- [ ] **Verify:** Connect a WebSocket client to `/ws/pipeline/test-id`, have orchestrator send an event → client receives it

---

### TASK-111 — Backend: Documents router (`routers/documents.py`)

- [ ] Create `backend/routers/documents.py`
- [ ] `POST /api/documents/upload`:
  - Accept `multipart/form-data` with `file` field
  - Validate file extension (pdf, docx, pptx, txt, md, png, jpg)
  - Save to `{vault_path}/uploads/{uuid}.{ext}`
  - Insert `Document` row with status `"queued"`
  - Launch `run_pipeline()` as a background task (`BackgroundTasks`)
  - Return `{ "doc_id": str, "status": "queued" }`
- [ ] `GET /api/documents`: return list of `DocumentSummary`, ordered by `uploaded_at DESC`
- [ ] `GET /api/documents/{id}`: return `DocumentDetail`
- [ ] `DELETE /api/documents/{id}?confirm=true`: delete document row (cascade deletes questions/notes/item_tags), delete file from disk, delete from Chroma collections
- [ ] `POST /api/documents/{id}/reprocess`: reset status to `"queued"`, delete existing questions/notes for this doc, re-run pipeline
- [ ] Register router in `main.py`
- [ ] **Verify:** Upload a PDF via `curl -F "file=@test.pdf" http://localhost:8765/api/documents/upload` → returns doc_id → `GET /api/documents/{id}` shows processing status

---

### TASK-112 — Frontend: Upload page (`pages/Upload.jsx`)

- [ ] Build upload UI using `react-dropzone`:
  - Drag-and-drop zone with file type guidance ("PDF, DOCX, PPTX, TXT supported")
  - File selected → show filename, size, "Upload" button
  - On upload: POST to `/api/documents/upload`, get `doc_id`
- [ ] On `doc_id` received: open WebSocket to `/ws/pipeline/{doc_id}` via `usePipeline` hook
- [ ] Build `PipelineProgress` component:
  - Shows each stage as a step: Extract → Classify → Chunk → Tag → Embed → Done
  - Current stage highlighted/animated
  - Progress bar fills based on `progress` field
  - Message text shown below (`"Extracted 47 Q&A pairs..."`)
  - On done: show summary card (X questions found, Y notes found, Z tags assigned)
  - On error: show error message in red with retry option
- [ ] **Verify:** Upload a real PDF → watch all pipeline stages complete in real-time → see summary

---

### TASK-113 — Frontend: `usePipeline` hook (`hooks/usePipeline.js`)

- [ ] Create `src/hooks/usePipeline.js`
- [ ] Returns `{ stage, progress, message, details, isComplete, isError, connect }`
- [ ] `connect(doc_id)`: opens `WebSocket` to `/ws/pipeline/{doc_id}`
- [ ] On message: parse JSON, update state
- [ ] On `stage === "done"`: set `isComplete = true`, close socket
- [ ] On `stage === "error"`: set `isError = true`, store error message, close socket
- [ ] Cleanup: close socket on component unmount
- [ ] **Verify:** Hook connects to WS, receives a manual test event, state updates correctly

---

### TASK-114 — Frontend: Documents page (`pages/Documents.jsx`)

- [ ] Fetch `GET /api/documents` on mount (poll every 5s if any doc has status != `"done"` or `"error"`)
- [ ] Show table/card list: filename, status badge (colour-coded), upload date, question count, note count
- [ ] Status badge colours: `queued`=gray, `extracting/classifying/chunking/tagging/embedding`=blue+spinner, `done`=green, `error`=red
- [ ] Each row: "View" button (navigates to detail), "Delete" button (confirmation dialog), "Reprocess" button (only on error status)
- [ ] Empty state: "No documents yet" with link to Upload page
- [ ] **Verify:** Upload a doc, watch status badge update live (polling), see final counts

---

### PHASE 1 COMPLETION CHECK

- [ ] Upload a 20-page Q&A PDF → pipeline runs to completion with no errors
- [ ] DB has questions, notes, item_tags, srs_cards all populated
- [ ] WebSocket events fire for each stage and show in Upload page UI
- [ ] Documents page shows correct status and counts
- [ ] `GET /api/documents/{id}` returns full detail
- [ ] Delete a document → removed from DB and disk

---

## PHASE 2 — Question Bank

> Done when: Can filter questions by multiple tags with AND logic, search semantically, view/edit questions, bookmark them.

---

### TASK-201 — Backend: Questions router (`routers/questions.py`)

- [ ] `GET /api/questions`:
  - Query params: `tags: list[str]` (repeated param), `search: str`, `difficulty: str`, `bookmarked: bool`, `doc_id: str`, `limit: int = 20`, `offset: int = 0`
  - Tag AND logic SQL:
    ```sql
    SELECT q.* FROM questions q
    JOIN item_tags it ON it.item_id = q.id AND it.item_type = 'question'
    JOIN tags t ON t.id = it.tag_id
    WHERE t.name IN (:tag_names)
    GROUP BY q.id
    HAVING COUNT(DISTINCT t.name) = :tag_count
    ```
  - If `search` param present: query ChromaDB `"questions"` collection with semantic search, get top 20 IDs, filter SQL results to those IDs
  - Return paginated `QuestionOut` list with `tags` and `srs_state` populated
- [ ] `GET /api/questions/{id}`: single question with full detail
- [ ] `PATCH /api/questions/{id}`: update text fields, toggle bookmark, add/remove tags
- [ ] `DELETE /api/questions/{id}`: delete question + srs_card + from Chroma
- [ ] Register router

---

### TASK-202 — Frontend: TagFilter component (`components/TagFilter.jsx`)

- [ ] Fetch all tags from `GET /api/tags` on mount
- [ ] Render a search input with autocomplete dropdown
- [ ] Selected tags shown as removable chips below input
- [ ] `onChange(selectedTags: string[])` callback prop
- [ ] Chips are colour-coded by `tag_type` (use `utils/tagColors.js`)
- [ ] Support keyboard: Enter selects highlighted option, Backspace removes last chip

---

### TASK-203 — Frontend: TagColors utility (`utils/tagColors.js`)

- [ ] Map `tag_type` to Tailwind colour classes:
  ```js
  { tech: 'bg-blue-100 text-blue-800', concept: 'bg-purple-100 text-purple-800',
    domain: 'bg-green-100 text-green-800', difficulty: 'bg-amber-100 text-amber-800',
    content_type: 'bg-gray-100 text-gray-700', custom: 'bg-pink-100 text-pink-800' }
  ```

---

### TASK-204 — Frontend: QuestionCard component (`components/QuestionCard.jsx`)

- [ ] Props: `question` (full QuestionOut object), `onEdit`, `onBookmark`, `onTagChange`
- [ ] Show: question text, answer text (collapsible), tag chips, difficulty badge, source attribution
- [ ] Bookmark icon button (filled/outline based on state)
- [ ] "Edit" button → inline edit mode for question/answer text with save/cancel
- [ ] "Add Tag" mini input for adding tags inline

---

### TASK-205 — Frontend: Question Bank page (`pages/QuestionBank.jsx`)

- [ ] Layout: filter panel (left/top) + question list (main)
- [ ] Filter panel: `TagFilter` component + difficulty dropdown + bookmarked toggle + search input
- [ ] On filter change: call `GET /api/questions?tags=X&tags=Y&difficulty=Z...`
- [ ] Show result count: "Showing 12 questions matching [LangGraph] [RAG]"
- [ ] Render list of `QuestionCard` components
- [ ] Pagination: load more button or infinite scroll
- [ ] Empty state: "No questions match these filters"
- [ ] **Verify:** Select 2 tags → only questions with BOTH tags appear. Confirm by checking a question that has only one of the two tags is absent.

---

### TASK-206 — Frontend: Semantic search in Question Bank

- [ ] Add a search bar at top of Question Bank
- [ ] On submit: pass `search` param to `GET /api/questions?search=...`
- [ ] Show "Semantic search results for: ..." label above results
- [ ] Semantic search and tag filter can work together (both params sent simultaneously)

---

### PHASE 2 COMPLETION CHECK

- [ ] Select 3 tags → result count matches AND logic (not OR)
- [ ] Semantic search returns relevant questions even without exact keyword match
- [ ] Edit a question inline → change persists on page refresh
- [ ] Bookmark a question → appears in bookmarked filter
- [ ] Delete a question → removed from list immediately

---

## PHASE 3 — Study Notes

> Done when: Select a topic → see notes from ALL relevant documents merged in logical order with source attribution.

---

### TASK-301 — Backend: Notes router (`routers/notes.py`)

- [ ] `GET /api/notes`: list with tag AND filter, same pattern as questions
- [ ] `GET /api/notes/topic/{tag_name}`:
  - Fetch all notes with this tag, ordered by `topic_order ASC` (then `order_index` as tiebreaker)
  - Include `source_doc_name` (join with `documents` table)
  - Return grouped by source doc sections for UI rendering
- [ ] `PATCH /api/notes/{id}`: update content, add/remove tags
- [ ] Register router

---

### TASK-302 — Frontend: NoteBlock component (`components/NoteBlock.jsx`)

- [ ] Props: `note` (NoteOut), `showSource: bool`
- [ ] Render: heading (if present), content (markdown rendered — use a simple renderer or just pre-wrap), tag chips, source attribution badge
- [ ] `SourceBadge` component: shows "📄 From: {original_name}" in a subtle pill

---

### TASK-303 — Frontend: Study Notes page (`pages/StudyNotes.jsx`)

- [ ] Left panel: tag selector (click a tag name to select it as the study topic)
  - Show all tags that have at least 1 note, with note counts
- [ ] Main panel: when a topic is selected, fetch `GET /api/notes/topic/{tag_name}`
- [ ] Render note blocks sequentially with `NoteBlock` component
- [ ] Show section dividers between notes from different source documents
- [ ] "Focus Mode" toggle: hides sidebar, maximises reading width, shows only content
- [ ] **Verify:** If 2 PDFs have notes tagged "LangGraph", selecting LangGraph shows notes from both, merged in order

---

### TASK-304 — Frontend: Annotation support

- [ ] Each `NoteBlock` has an "Add Note" button that opens a text area
- [ ] On save: `POST /api/annotations` (`{ item_type: "note", item_id, annotation_text }`)
- [ ] Saved annotations shown below the note block in a different colour
- [ ] Add `/api/annotations` endpoint to backend (simple CRUD)

---

### PHASE 3 COMPLETION CHECK

- [ ] Upload 2 PDFs on the same topic → notes from both appear merged in Study Notes view
- [ ] `topic_order` is logical (fundamentals before advanced)
- [ ] Source attribution correct on each note block
- [ ] Focus Mode hides sidebar correctly

---

## PHASE 4 — Tag System

> Done when: Tag Manager is fully functional — browse, search, merge, delete tags.

---

### TASK-401 — Backend: Tags router (`routers/tags.py`)

- [ ] `GET /api/tags`: all tags sorted by `usage_count DESC`. Query params: `type`, `search` (name contains)
- [ ] `POST /api/tags`: create custom tag `{ name, tag_type: "custom" }`; return `TagOut`
- [ ] `POST /api/tags/merge`: reassign all `item_tags` rows from `source_tag_id` to `target_tag_id`, delete source tag, update `usage_count` on target
- [ ] `DELETE /api/tags/{id}`: only allowed if `usage_count == 0` OR `?force=true` (which deletes all `item_tags` with this tag first)
- [ ] Register router

---

### TASK-402 — Frontend: TagChip component (`components/TagChip.jsx`)

- [ ] Props: `tag: TagOut`, `removable?: bool`, `onRemove?: fn`, `size?: "sm"|"md"`
- [ ] Colour from `tagColors.js` based on `tag.tag_type`
- [ ] If `removable`: show × button

---

### TASK-403 — Frontend: Tag Manager page (`pages/TagManager.jsx`)

- [ ] Fetch all tags with counts
- [ ] Search input to filter tag list
- [ ] Filter by type (tab row: All / Tech / Concept / Domain / Custom / ...)
- [ ] Each tag row: name, type badge, usage count, "Merge Into..." button, "Delete" button
- [ ] "Merge Into..." opens a modal: search for target tag, confirm → calls `/api/tags/merge`
- [ ] Delete disabled if usage_count > 0 (show tooltip "Remove from X items first or use force delete")
- [ ] "Create Tag" button at top: name input + type dropdown → calls `POST /api/tags`
- [ ] **Verify:** Merge "lang-graph" into "LangGraph" → all items previously tagged "lang-graph" now show "LangGraph"

---

### PHASE 4 COMPLETION CHECK

- [ ] All 200 vocabulary tags visible in Tag Manager with correct types
- [ ] After uploading a doc, new tags (from tagging stage) appear in Tag Manager with usage counts
- [ ] Merge works: source tag disappears, target tag usage_count increases by source's count
- [ ] TagFilter autocomplete in Question Bank and Study Notes uses updated tag list

---

## PHASE 5 — Flashcards + SRS

> Done when: Can start a flashcard session, flip cards, rate recall, and see next review dates scheduled.

---

### TASK-501 — Backend: SM-2 algorithm (`services/srs_service.py`)

- [ ] Create `backend/services/srs_service.py`
- [ ] Implement `calculate_next_review(card: SRSCard, rating: str) -> SRSCard`:
  - SM-2 algorithm:
    - `again`: interval = 1 day, repetitions = 0, ease unchanged
    - `hard`: interval = max(1, interval * 1.2), ease -= 0.15 (min 1.3)
    - `good`: if repetitions < 2: interval = 1; else: interval = round(interval * ease); ease unchanged
    - `easy`: interval = round(interval * ease * 1.3); ease += 0.15; repetitions++
  - Set `due_date = now + timedelta(days=interval)`
  - Return updated card (do not commit — caller commits)

---

### TASK-502 — Backend: SRS router (`routers/srs.py`)

- [ ] `GET /api/srs/due`: questions where `srs_cards.due_date <= now`. Query params: `tags[]` (AND filter on question tags), `limit: int = 20`
- [ ] `POST /api/srs/review`:
  - Accept `ReviewSubmit`
  - Fetch `SRSCard` for `question_id`
  - Call `calculate_next_review(card, rating)`
  - Insert `SRSReview` row
  - Update `SRSCard` in DB
  - Return updated `SRSStateOut`
- [ ] `GET /api/srs/stats`: `{ total_cards, due_today, mastered (interval >= 21 days), learning, new (repetitions == 0) }`
- [ ] `POST /api/srs/session/start`: create `StudySession` row, return `{ session_id, first_card: QuestionOut | null }`
- [ ] `POST /api/srs/session/{id}/end`: set `ended_at`, `cards_reviewed`, return summary
- [ ] Register router

---

### TASK-503 — Frontend: FlashCard component (`components/FlashCard.jsx`)

- [ ] 3D flip animation using `framer-motion`:
  - Front: question text + tag chips
  - Back: answer text + source attribution
  - Click card (or "Show Answer" button) → flip
- [ ] After flip: show rating buttons row: **Again** (red) | **Hard** (orange) | **Good** (green) | **Easy** (blue)
- [ ] On rating click: call `POST /api/srs/review`, emit `onRated(rating, next_due)` callback
- [ ] Show next review date briefly after rating: "Next review: 3 days" toast

---

### TASK-504 — Frontend: `useSRS` hook (`hooks/useSRS.js`)

- [ ] State: `{ session, currentCard, queuedCards, reviewedCount, isComplete }`
- [ ] `startSession(tag_filter)`: calls `POST /api/srs/session/start`, loads due cards
- [ ] `submitRating(rating)`: calls review endpoint, loads next card from queue
- [ ] `endSession()`: calls `POST /api/srs/session/{id}/end`, returns summary
- [ ] When queue empty: `isComplete = true`

---

### TASK-505 — Frontend: Flashcards page (`pages/Flashcards.jsx`)

- [ ] Pre-session screen:
  - Shows "X cards due today"
  - `TagFilter` to optionally filter by topic
  - "Start Session" button
- [ ] Session screen: `FlashCard` component full-width + progress indicator "Card 3 of 12"
- [ ] Post-session screen: summary — reviewed count, by-rating breakdown, streak update
- [ ] Dashboard widget: "Due Today: X cards" with "Study Now" button

---

### PHASE 5 COMPLETION CHECK

- [ ] Start session → cards appear → flip works → rating recorded → next card loads
- [ ] `again` rated card appears again in same session; `easy` card gets longer interval
- [ ] Session ends when all due cards reviewed
- [ ] `GET /api/srs/stats` returns correct counts
- [ ] Due dates visible in Question Bank detail view

---

## PHASE 6 — Progress Tracking

> Done when: Dashboard shows meaningful stats — streak, heatmap, topic coverage, weak areas.

---

### TASK-601 — Backend: Progress service + router

- [ ] `services/progress_service.py`:
  - `get_study_streak(db)`: count consecutive days with at least 1 `srs_review` row
  - `get_heatmap_data(db, days=365)`: reviews per day for last N days → `[{ date, count }]`
  - `get_topic_coverage(db)`: per tag: `{ tag_name, total_questions, reviewed_once, mastered }`
  - `get_weak_areas(db, n=5)`: tags with lowest avg `ease_factor` across their cards
- [ ] `routers/progress.py`:
  - `GET /api/progress/dashboard`: calls all service functions, returns combined object
  - `GET /api/progress/topic/{tag_name}`: detailed stats for one topic

---

### TASK-602 — Frontend: StudyHeatmap component (`components/StudyHeatmap.jsx`)

- [ ] GitHub-style calendar heatmap for past 52 weeks
- [ ] Uses `recharts` or a custom SVG grid
- [ ] Colour intensity based on review count (0=gray, 1-2=light green, 3-5=medium, 6+=dark)
- [ ] Hover tooltip: "June 15: 8 cards reviewed"

---

### TASK-603 — Frontend: Dashboard page (`pages/Dashboard.jsx`)

- [ ] Stats row: streak (🔥 X days), due today, total questions, documents uploaded
- [ ] `StudyHeatmap` component (full width)
- [ ] Topic coverage section: top 10 tags as progress bars (reviewed % + mastered %)
- [ ] Weak areas card: top 5 tags needing attention
- [ ] Recent documents: last 3 uploads with status
- [ ] "Quick Study" button: starts SRS session with no tag filter

---

### PHASE 6 COMPLETION CHECK

- [ ] After reviewing cards on 3 consecutive days, streak shows 3
- [ ] Heatmap shows activity on days cards were reviewed
- [ ] Topic coverage % increases after studying that topic
- [ ] Weak areas shows tags with lowest recall

---

## PHASE 7 — Export / Import

> Done when: Can export tagged content as `.phvault`, share the file, and import it on another vault.

---

### TASK-701 — Backend: Vault service (`services/vault_service.py`)

- [ ] Implement `export_vault(tag_ids: list[str] | None, doc_ids: list[str] | None, passphrase: str, db, output_dir: str) -> str`:
  - Query questions and notes matching the filter
  - Build `content.json` (see PROJECT.md §11.4 schema)
  - Encrypt with `crypto.encrypt_vault_payload()`
  - Build `meta.json` (unencrypted, see §11.2)
  - ZIP both into `{output_dir}/{timestamp}-export.phvault`
  - Return file path
- [ ] Implement `preview_vault(file_path: str) -> dict`: open ZIP, parse `meta.json` without passphrase
- [ ] Implement `import_vault(file_path: str, passphrase: str, collision_strategy: str, db) -> dict`:
  - Open ZIP, read `meta.json`
  - Decrypt `encrypted_content.bin` using passphrase
  - Parse `content.json`
  - For each question: check collision by `question_text` match
  - Apply `collision_strategy` (see §11.5)
  - Insert non-skipped items, create tags if needed, create SRS cards
  - Return `{ imported: int, skipped: int, collisions: list }`

---

### TASK-702 — Backend: Vault router (`routers/vault.py`)

- [ ] `POST /api/vault/export`: calls `export_vault()`, returns `{ file_path, file_name, item_counts }`
- [ ] `POST /api/vault/import/preview`: calls `preview_vault()`, returns `meta.json` contents
- [ ] `POST /api/vault/import`: calls `import_vault()`, returns import result summary
- [ ] Register router

---

### TASK-703 — Frontend: Vault Tools page (`pages/VaultTools.jsx`)

- [ ] **Export panel**:
  - Tag multi-select (which topics to export)
  - Or "Export All" toggle
  - Passphrase input (with strength indicator)
  - "Export" button → shows file path of generated `.phvault`
  - Warning: "Share this file only with people you trust. Don't lose the passphrase — there's no recovery."
- [ ] **Import panel**:
  - File path input for `.phvault` file
  - "Preview" button → shows unencrypted metadata (tag names, item counts) before committing
  - Passphrase input
  - Collision strategy radio: Keep Mine / Keep Theirs / Keep Both
  - "Import" button → shows progress, then summary (X imported, Y skipped)

---

### PHASE 7 COMPLETION CHECK

- [ ] Export 10 questions tagged "LangGraph" → `.phvault` file generated in vault/exports/
- [ ] Preview the file → see tag names and counts without needing passphrase
- [ ] Import the file with correct passphrase → questions appear in Question Bank
- [ ] Import with wrong passphrase → clear error shown
- [ ] Import with collision → collision resolution works per chosen strategy

---

## PHASE 8 — Polish & QA

> Done when: App feels production-quality. Every state has proper UI. No console errors.

---

### TASK-801 — Loading states + skeletons

- [ ] Every page that fetches data: show skeleton loaders while loading (not blank white)
- [ ] `QuestionCard` skeleton: grey animated bars for question/answer/tags
- [ ] `NoteBlock` skeleton: heading bar + 3 content lines
- [ ] Dashboard stats: skeleton number boxes

---

### TASK-802 — Empty states

- [ ] Documents page: empty = upload illustration + "Upload your first PDF"
- [ ] Question Bank: no results = "No questions match your filters. Try removing a tag." OR "No questions yet — upload a PDF to get started."
- [ ] Study Notes: no topic selected = "Select a topic from the left panel"
- [ ] Flashcards: no cards due = "🎉 You're all caught up! Next review due {date}."
- [ ] Progress: no activity = "Start studying to track your progress."

---

### TASK-803 — Error states

- [ ] Failed API call: show inline error with "Retry" button (not just a toast)
- [ ] Pipeline error: show error message on Documents page + "Reprocess" button
- [ ] Import failure (wrong passphrase): show clear error, don't clear the passphrase input
- [ ] Vault not configured: block all navigation except Settings with a banner

---

### TASK-804 — Responsive layout

- [ ] Sidebar collapses to icons-only below 1280px width
- [ ] Sidebar becomes bottom nav bar below 768px
- [ ] Question Bank: filter panel moves above list on mobile
- [ ] FlashCard: full screen on mobile with swipe gesture support (swipe right = Good, swipe left = Again)

---

### TASK-805 — Launcher scripts

- [ ] `launcher.py`:
  ```python
  # 1. Check if venv exists; if not, create it and pip install
  # 2. Build frontend: npm run build (if dist/ doesn't exist or --rebuild flag)
  # 3. Start uvicorn on port 8765
  # 4. Wait until /api/health returns 200 (poll with timeout)
  # 5. Open http://localhost:8765 in default browser
  # 6. Print "Prep Helper running at http://localhost:8765 — Press Ctrl+C to stop"
  ```
- [ ] `start.sh`: `#!/bin/bash` wrapper that activates venv and runs `python launcher.py`
- [ ] `start.bat`: Windows batch equivalent
- [ ] `docker-compose.yml`: single service, mounts a host directory as vault, exposes port 8765

---

### TASK-806 — README.md

- [ ] Installation section: Prerequisites (Python 3.11+, Node 18+), clone, run `./start.sh`
- [ ] First-run section: vault setup, adding API key, uploading first PDF
- [ ] FAQ: "Where is my data?" / "Can I move my vault?" / "What if I forget my export passphrase?" / "Which AI provider should I use?"
- [ ] Screenshots section (placeholder markdown, agent to fill with actual screenshots)

---

### TASK-807 — Final end-to-end test

- [ ] Fresh machine: delete `~/.prephelper/` and vault folder
- [ ] Run `./start.sh` → welcome screen appears
- [ ] Set up vault, enter Groq API key, test it → ✅
- [ ] Upload a Q&A PDF → pipeline completes, questions visible in Question Bank
- [ ] Upload a notes PDF on same topic → Study Notes shows merged sequential view
- [ ] Start flashcard session → flip, rate, session ends with summary
- [ ] Check Dashboard → streak shows 1, heatmap has today marked
- [ ] Export questions tagged with one topic → `.phvault` generated
- [ ] Import the `.phvault` → questions imported successfully
- [ ] All pages load without console errors

---

*TASKS.md — Prep Helper | v1.0 | All tasks must be completed in order within each phase.*
*Check off each task before proceeding. Phase completion checks must all pass before starting the next phase.*
