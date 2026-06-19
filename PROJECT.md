# PREP HELPER — Complete Project Documentation

> **AI-Powered Local Knowledge Management System**
> Version 1.0 | June 2026 | Status: Ready for Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Features — Detailed Requirements](#4-features--detailed-requirements)
5. [User Stories](#5-user-stories)
6. [Acceptance Criteria](#6-acceptance-criteria)
7. [Technical Architecture](#7-technical-architecture)
8. [Database Schema](#8-database-schema)
9. [AI Pipeline](#9-ai-pipeline)
10. [API Design](#10-api-design)
11. [Export / Import Spec](#11-export--import-spec)
12. [Project File Structure](#12-project-file-structure)
13. [Implementation Phases](#13-implementation-phases)
14. [Technology Dependencies](#14-technology-dependencies)
15. [Key Design Decisions](#15-key-design-decisions)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Future Roadmap (v2+)](#17-future-roadmap-v2)

---

## 1. Executive Summary

Prep Helper is a **local-first, AI-powered knowledge management system** for tech learners. It solves a specific, painful problem: people collect PDFs from Instagram influencers, newsletters, and community groups but never actually use them when they need to study.

The product turns passive PDF hoarding into an active, searchable, queryable knowledge base that lives entirely on the user's machine.

**Core Value Proposition:**
- 📥 Drop in any PDF → AI extracts, structures, and tags everything automatically
- 🏷️ Every question and note gets concept tags for precise retrieval
- 🔍 Query by one tag, or intersect multiple tags to find exactly what you need
- 🔗 Multiple uploads on the same topic merge into one coherent sequential study view
- 📤 Export / import encrypted bundles to share with friends using the same app
- 🗂️ Everything stays local — your folder, your data, your AI key

---

## 2. Problem Statement

### 2.1 User Pain Points

- Tech learners follow Instagram/YouTube creators who share PDF notes/QA sets in exchange for comments — resulting in dozens of PDFs that pile up unused
- No unified way to search across multiple PDFs — each is a silo
- When preparing for interviews or exams, users waste time re-reading full PDFs instead of filtering by concept
- No concept-level organisation: "LangGraph questions" buried inside an "Agentic AI Full Guide" PDF alongside unrelated content
- No way to share curated subsets of knowledge with peers without sharing entire files

### 2.2 Target User

**Primary:** Final-year CS/IT students and early-career engineers (0–3 years) preparing for technical interviews, competitive exams, or skill upgrades in AI/ML, Full Stack, DevOps, and related domains.

**Secondary:** Self-learners and bootcamp graduates who consume creator-economy educational content and need a smarter way to retain and retrieve it.

---

## 3. Goals & Non-Goals

### ✅ Goals

- Process PDFs into structured Q&A and study notes automatically
- Tag every content item with one or more concept labels using AI
- Enable tag-intersection queries (show items with ALL selected tags)
- Merge multi-document content sequentially per concept
- Flashcard / spaced repetition for questions (SM-2 algorithm)
- Progress tracking per topic (heatmap, coverage %, weak areas)
- Encrypted export/import for sharing (`.phvault` format)
- Bring-your-own API key (Gemini, Groq, OpenAI)
- 100% local — no cloud storage, no telemetry

### ❌ Non-Goals (v1)

- No multi-user real-time collaboration
- No mobile app (web only, via localhost)
- No built-in AI model hosting (BYOK only)
- No cloud sync or backup
- No PDF editing or annotation markup
- No support for video/audio content
- No social feed or creator marketplace

---

## 4. Features — Detailed Requirements

### 4.1 Vault Setup & Folder Management

On first launch, the user selects a root folder ("Vault") on their local file system. All application data — uploaded PDFs, generated assets, SQLite database, vector index — lives inside this folder. The app never writes outside it.

- **FR-001:** First-run wizard prompts folder selection via a path input (since we're a web app, user types or pastes their folder path; backend validates it exists and is writable)
- **FR-002:** Vault path stored in local config file at `~/.prephelper/config.json`
- **FR-003:** User can change vault via Settings (triggers re-index warning dialog)
- **FR-004:** Vault folder structure is auto-created on first setup

### 4.2 Document Ingestion Pipeline

This is the core AI pipeline. When a PDF (or other supported file) is uploaded, the following sequence runs asynchronously:

| Step | What Happens | Responsible |
|------|-------------|-------------|
| 1. Upload | File copied to `vault/uploads/` with UUID filename | FastAPI endpoint |
| 2. Extract | MarkItDown converts file to clean Markdown text | `markitdown` library |
| 3. Classify | AI determines: QA_HEAVY / NOTES_HEAVY / MIXED | LLM via user key |
| 4. Chunk | Text split into semantic chunks (Q+A pairs or note paragraphs) | Custom chunker |
| 5. Tag | AI assigns 1–5 concept tags per chunk | LLM via user key |
| 6. Store | Chunks saved to SQLite + embeddings to ChromaDB | SQLite + Chroma |
| 7. Done | Document status updated to `processed` | FastAPI service |

**Supported Input Formats (via MarkItDown):**
- PDF (`.pdf`) — primary use case
- Word documents (`.docx`, `.doc`)
- PowerPoint (`.pptx`) — from creator slide decks
- Plain text (`.txt`, `.md`)
- Images with text (`.png`, `.jpg`) — via OCR where supported

**Processing status values:** `queued` → `extracting` → `classifying` → `chunking` → `tagging` → `embedding` → `done` | `error`

Frontend connects via WebSocket to get real-time stage-by-stage progress updates.

### 4.3 Question Bank

Every Q&A pair extracted from documents is stored as an independent Question entity with rich metadata.

- **FR-010:** Each question stores: `question_text`, `answer_text`, `source_document`, `source_page`, `difficulty`, `tags[]`, `bookmarked`, `created_at`
- **FR-011:** Tag filtering uses **AND logic** — selecting [LangGraph, RAG] returns ONLY questions tagged with BOTH
- **FR-012:** Tag auto-suggest based on existing tag vocabulary as user types in filter
- **FR-013:** Questions display with tags as coloured chips; source document shown as footnote attribution
- **FR-014:** User can manually edit question/answer text and add/remove tags inline
- **FR-015:** User can mark a question as "Bookmarked" for quick re-access
- **FR-016:** Semantic search within questions (not just tag match) via ChromaDB vector similarity

### 4.4 Study Notes

Non-Q&A content (explanations, concepts, code snippets, diagram descriptions) is stored as Study Note chunks, organised sequentially.

- **FR-020:** Notes stored with: `content`, `heading` (inferred by AI), `tags[]`, `source_doc`, `order_index`, `content_type` (definition / example / code / concept)
- **FR-021:** When user selects a topic, all note chunks tagged with that topic from ALL documents are assembled in one sequential view
- **FR-022:** Ordering heuristic: fundamentals first → implementations → advanced examples → edge cases (AI-determined during ingestion via a one-shot reordering call)
- **FR-023:** "Focus Mode" — clean distraction-free reading view with no sidebar
- **FR-024:** User can add personal annotations/highlights to any note block
- **FR-025:** Each note block shows source attribution ("From: Advanced LangGraph.pdf")

### 4.5 Tag System

The tag system is the backbone of the entire product.

| Tag Type | Example | Source |
|----------|---------|--------|
| Technology | LangGraph, RAG, Docker, React | AI + predefined vocab |
| Concept | State Management, Vector Embedding, CI/CD | AI extraction |
| Difficulty | Beginner, Intermediate, Advanced | AI estimation |
| Content Type | Question, Definition, Code Example | Auto-assigned |
| Domain | AI/ML, Backend, DevOps, System Design | AI + predefined vocab |
| User Custom | interview-prep, revision, important | Manual user tags |

- **FR-030:** Predefined vocabulary of ~200 tech tags seeded on first run
- **FR-031:** AI can create free-form tags beyond vocabulary for novel concepts
- **FR-032:** Tag Manager page: see all tags with counts, merge duplicates (e.g. "lang-graph" → "LangGraph"), delete unused tags
- **FR-033:** Tag autocomplete in all search/filter inputs across the app

### 4.6 Flashcard & Spaced Repetition Mode

- **FR-040:** User starts a "Study Session" by selecting tags → creates a filtered deck
- **FR-041:** Cards shown one at a time — question side first, user flips to reveal answer
- **FR-042:** After seeing answer, user rates recall: **Again / Hard / Good / Easy**
- **FR-043:** SM-2 algorithm calculates next review date based on rating and history
- **FR-044:** Dashboard shows "X cards due today" count (filterable by tag)
- **FR-045:** Session summary screen: cards reviewed, mastered, needs practice

### 4.7 Progress Tracking

- **FR-050:** Per-topic progress: % of questions reviewed at least once, % mastered (Good/Easy rating ≥3 times)
- **FR-051:** Study streak tracker (consecutive days with ≥1 session)
- **FR-052:** GitHub-style study activity heatmap (calendar view)
- **FR-053:** "Weak areas" card: tags where average recall score is lowest
- **FR-054:** Document coverage: which uploaded docs have been studied vs untouched

### 4.8 Export & Import (Encrypted Bundles)

- **FR-060:** Export: select tags or specific documents → generates a `.phvault` file
- **FR-061:** `.phvault` = renamed ZIP containing `encrypted_content.bin` + `meta.json`
- **FR-062:** User sets a passphrase during export; recipient needs same passphrase to import
- **FR-063:** Import: user provides file path + passphrase → content merged into local vault
- **FR-064:** On import collision (same question already exists): show diff, let user choose Keep Mine / Keep Theirs / Keep Both
- **FR-065:** Export includes all tags and SRS progress metadata

### 4.9 API Key Management & Model Selection

- **FR-070:** Settings page: enter API keys for Gemini (Google), Groq, or OpenAI
- **FR-071:** Keys stored AES-encrypted in `~/.prephelper/config.json`; never logged
- **FR-072:** User selects default model per task type: extraction model (cheap/fast), tagging model (balanced), complex reasoning model (capable)
- **FR-073:** Supported providers: Google Gemini 1.5 Flash / Pro, Groq (llama-3.1, gemma-2), OpenAI GPT-4o-mini / GPT-4o
- **FR-074:** Token usage estimate shown before processing large batches
- **FR-075:** Failed API calls queue for retry; user notified with option to retry or skip

---

## 5. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|-----------|
| US-01 | Tech learner | Upload a PDF I received from an IG creator | It gets organised automatically without manual work |
| US-02 | Interview prepper | Filter questions by "LangGraph" AND "State Machine" | I only see questions on that exact intersection |
| US-03 | Student | Start a flashcard session on "RAG" concepts | I can test my knowledge efficiently before an interview |
| US-04 | User | See all study notes on "Agentic AI" from 3 different PDFs | I get one coherent sequential view instead of jumping between files |
| US-05 | User | Export my "System Design" knowledge bundle | I can share it with a friend preparing for the same company |
| US-06 | Friend | Import a .phvault file my friend shared | I instantly get all their curated content in my vault |
| US-07 | User | See my study progress on the dashboard | I know which topics need more revision |
| US-08 | User | Merge duplicate tags like "agentic-ai" and "Agentic AI" | My tag system stays clean and consistent |

---

## 6. Acceptance Criteria

### AC-01: PDF Upload → Structured Content (Happy Path)
1. User uploads a 20-page Q&A PDF
2. Processing indicator shows pipeline stages in real-time via WebSocket
3. Within 60 seconds (typical PDF), processing completes
4. Question bank shows all extracted Q&A pairs with tags
5. Study notes shows all extracted notes with tags
6. Tag Manager reflects all new tags added

### AC-02: Tag Intersection Query
1. User opens Question Bank
2. Selects tags: [RAG] [LangGraph] [Python]
3. System returns ONLY questions tagged with ALL THREE
4. A question tagged [RAG] [Python] but NOT [LangGraph] does NOT appear
5. Result count updates instantly as tags are added/removed

### AC-03: Multi-Document Topic View
1. User uploaded "Agentic AI Basics.pdf" last month and "Advanced LangGraph.pdf" today
2. User selects "Agentic AI" in Study Notes
3. Notes from both documents appear merged in one sequential view
4. Source attribution visible ("From: Advanced LangGraph.pdf")
5. Ordering is logical: fundamentals → advanced → implementation

### AC-04: Flashcard Session
1. User selects tags [LangGraph] and starts a session
2. Cards appear one at a time, question side up
3. User flips card, sees answer, rates: Again / Hard / Good / Easy
4. Session ends, summary shown
5. Next review dates updated in database per SM-2 algorithm

### AC-05: Export → Import Round Trip
1. User A exports questions tagged [System Design] with passphrase "prep2026"
2. `.phvault` file is generated and downloadable
3. User B receives file, opens Import in their app
4. Preview shows metadata (count, tags) without needing passphrase
5. User B enters passphrase → questions import into their vault
6. Imported questions appear in User B's Question Bank with all original tags

---

## 7. Technical Architecture

### 7.1 Stack Overview

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | React 18 + Vite + TailwindCSS | UI — served as static build from FastAPI |
| Backend API | Python 3.11+ + FastAPI + Uvicorn | REST API + WebSocket for pipeline progress |
| Database | SQLite via SQLAlchemy + Alembic | Structured data: docs, questions, notes, tags, SRS |
| Vector Store | ChromaDB (local, persistent) | Semantic search over question/note embeddings |
| AI Pipeline | LangChain + custom orchestrator | Extraction, classification, tagging, chunking |
| File Extraction | MarkItDown + PyMuPDF (fallback) | PDF/DOCX/PPTX → clean Markdown |
| Encryption | Python `cryptography` (AES-256-GCM) | Export/import vault bundles |
| Embeddings | Provider-specific via LangChain | Gemini / OpenAI ada-002 / nomic-embed |
| Scheduler | APScheduler (in-process) | SRS due-card calculation, background tasks |
| Launcher | Shell script + `launcher.py` | One-click start; auto-opens browser |

### 7.2 Architecture Principles

1. **Local-first**: The backend is a Python process the user starts once. Frontend is a React SPA served from the same FastAPI process. The only external network calls are to the user's chosen AI provider.
2. **Single process**: User runs ONE command (`python launcher.py`). FastAPI serves both the API (`/api/*`) and the built React app (`/*`) on the same port (default: `8765`).
3. **SQLite is source of truth**: ChromaDB is a derived index. If Chroma index is inconsistent on startup, it rebuilds from SQLite automatically.
4. **Vault isolation**: The app never writes outside the user-selected vault folder (except `~/.prephelper/config.json` for machine-level config).

### 7.3 Vault Folder Structure

```
vault/                              ← user-selected root
├── uploads/                        # Original uploaded files (UUID-named, extension preserved)
│   ├── a3f91c2d.pdf
│   └── b7e20481.docx
├── exports/                        # Generated .phvault bundles
│   └── system-design-2026-06.phvault
├── db/
│   └── prephelper.sqlite           # All structured data (single file, easily backed up)
├── chroma/                         # ChromaDB vector index (auto-managed, rebuildable)
├── logs/
│   └── pipeline.log                # Processing logs with timestamps
└── .prephelper_meta.json           # Vault version, created_at, schema_version
```

```
~/.prephelper/                      ← machine-level config (outside vault)
├── config.json                     # vault_path, encrypted API keys, model prefs, theme
└── config.json.bak                 # Auto-backup before any config change
```

---

## 8. Database Schema

### Table: `documents`
```sql
CREATE TABLE documents (
    id              TEXT PRIMARY KEY,           -- UUID
    filename        TEXT NOT NULL,              -- UUID-based filename on disk
    original_name   TEXT NOT NULL,              -- Original uploaded filename
    file_type       TEXT NOT NULL,              -- pdf, docx, pptx, txt
    uploaded_at     DATETIME DEFAULT NOW(),
    status          TEXT DEFAULT 'queued',      -- queued/extracting/classifying/chunking/tagging/embedding/done/error
    doc_type        TEXT,                       -- QA_HEAVY / NOTES_HEAVY / MIXED (set after classify)
    page_count      INTEGER,
    chunk_count     INTEGER DEFAULT 0,
    question_count  INTEGER DEFAULT 0,
    note_count      INTEGER DEFAULT 0,
    error_message   TEXT,
    tag_summary     TEXT                        -- JSON array of top tags for quick display
);
```

### Table: `questions`
```sql
CREATE TABLE questions (
    id              TEXT PRIMARY KEY,           -- UUID
    document_id     TEXT REFERENCES documents(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    answer_text     TEXT NOT NULL,
    difficulty      TEXT,                       -- beginner / intermediate / advanced
    source_page     INTEGER,
    order_in_doc    INTEGER,                    -- position within source document
    bookmarked      BOOLEAN DEFAULT FALSE,
    created_at      DATETIME DEFAULT NOW(),
    updated_at      DATETIME DEFAULT NOW()
);
```

### Table: `notes`
```sql
CREATE TABLE notes (
    id              TEXT PRIMARY KEY,           -- UUID
    document_id     TEXT REFERENCES documents(id) ON DELETE CASCADE,
    heading         TEXT,                       -- AI-inferred section heading
    content         TEXT NOT NULL,
    content_type    TEXT,                       -- definition / example / code / concept / summary
    order_index     INTEGER,                    -- position within source document
    topic_order     INTEGER,                    -- position when merged across docs (set by reorder call)
    created_at      DATETIME DEFAULT NOW()
);
```

### Table: `tags`
```sql
CREATE TABLE tags (
    id          TEXT PRIMARY KEY,               -- UUID
    name        TEXT UNIQUE NOT NULL,           -- normalised (e.g. "LangGraph", "RAG")
    tag_type    TEXT NOT NULL,                  -- tech / concept / domain / difficulty / content_type / custom
    usage_count INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT NOW()
);
```

### Table: `item_tags`
```sql
CREATE TABLE item_tags (
    item_type   TEXT NOT NULL,                  -- 'question' or 'note'
    item_id     TEXT NOT NULL,
    tag_id      TEXT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_type, item_id, tag_id)
);
CREATE INDEX idx_item_tags_tag ON item_tags(tag_id);
CREATE INDEX idx_item_tags_item ON item_tags(item_type, item_id);
```

### Table: `srs_cards`
```sql
CREATE TABLE srs_cards (
    id              TEXT PRIMARY KEY,           -- UUID
    question_id     TEXT UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
    ease_factor     REAL DEFAULT 2.5,           -- SM-2 ease factor (min 1.3)
    interval_days   INTEGER DEFAULT 0,          -- days until next review
    due_date        DATETIME DEFAULT NOW(),     -- next review due
    repetitions     INTEGER DEFAULT 0,          -- successful review streak
    last_reviewed   DATETIME
);
```

### Table: `srs_reviews`
```sql
CREATE TABLE srs_reviews (
    id              TEXT PRIMARY KEY,           -- UUID
    card_id         TEXT REFERENCES srs_cards(id) ON DELETE CASCADE,
    reviewed_at     DATETIME DEFAULT NOW(),
    rating          TEXT NOT NULL,              -- again / hard / good / easy
    response_time_ms INTEGER
);
CREATE INDEX idx_reviews_card ON srs_reviews(card_id);
CREATE INDEX idx_reviews_date ON srs_reviews(reviewed_at);
```

### Table: `study_sessions`
```sql
CREATE TABLE study_sessions (
    id              TEXT PRIMARY KEY,
    started_at      DATETIME DEFAULT NOW(),
    ended_at        DATETIME,
    tag_filter      TEXT,                       -- JSON array of tag IDs used
    cards_reviewed  INTEGER DEFAULT 0,
    session_type    TEXT DEFAULT 'flashcard'    -- flashcard / browse
);
```

### Table: `user_annotations`
```sql
CREATE TABLE user_annotations (
    id              TEXT PRIMARY KEY,
    item_type       TEXT NOT NULL,              -- 'question' or 'note'
    item_id         TEXT NOT NULL,
    annotation_text TEXT NOT NULL,
    created_at      DATETIME DEFAULT NOW()
);
```

**Key indexes to add:**
```sql
CREATE INDEX idx_questions_doc ON questions(document_id);
CREATE INDEX idx_notes_doc ON notes(document_id);
CREATE INDEX idx_notes_topic_order ON notes(topic_order);
CREATE INDEX idx_srs_due ON srs_cards(due_date);
CREATE INDEX idx_tags_name ON tags(name);
```

---

## 9. AI Pipeline

### 9.1 Stage Details

#### Stage 1: Extract (No LLM)
- Use `markitdown` to convert file → Markdown
- Fallback to `PyMuPDF` (`fitz`) if MarkItDown fails or produces <100 chars
- PyMuPDF also provides `page_number` for each text block (used for `source_page` field)
- Clean the Markdown: remove repeated headers, fix encoding issues, normalise whitespace

#### Stage 2: Classify
```
SYSTEM: You are a document classifier. Respond ONLY with valid JSON, no markdown.
USER: Classify this document excerpt. Return: {"type": "QA_HEAVY"|"NOTES_HEAVY"|"MIXED", "confidence": 0.0-1.0, "qa_ratio": 0.0-1.0}
Document excerpt (first 2000 chars): {text}
```

#### Stage 3a: Chunk (Q&A documents)
- First pass: regex patterns for common Q&A formats:
  - `Q: ... A: ...`
  - `**Question N:** ... **Answer:** ...`
  - Numbered `1. Question ... Answer:` patterns
- Second pass (LLM fallback for non-standard formats):
```
SYSTEM: Extract all question-answer pairs from this text. Return ONLY a JSON array: [{"q": "...", "a": "...", "page_ref": N_or_null}, ...]
No markdown. No preamble.
USER: {chunk_of_text}
```

#### Stage 3b: Chunk (Notes documents)
- Split at Markdown heading boundaries (`#`, `##`, `###`)
- If section > 500 tokens, split further at paragraph breaks
- Each chunk keeps its nearest ancestor heading as context

#### Stage 4: Tag (Batched)
- Batch 10 chunks per LLM call to save tokens
- Send predefined tag vocabulary list in system prompt (first 50 most common tags)
```
SYSTEM: You are a technical content tagger. Given content chunks, assign tags from the vocabulary and estimate difficulty.
Vocabulary (use these where applicable, create new ones if needed): {tag_vocab_sample}
Return ONLY JSON array (one object per chunk, same order): [{"id": "chunk_id", "tags": ["tag1","tag2"], "difficulty": "beginner"|"intermediate"|"advanced"}, ...]

USER: {json_array_of_chunks}
```

#### Stage 5: Topic Ordering (Notes only, per-tag)
- After all notes are tagged, for each tag that has >3 note chunks across >1 document:
```
SYSTEM: Reorder these study note sections into the most logical learning sequence, from fundamentals to advanced.
Return ONLY a JSON array of IDs in the correct order: ["id1", "id2", ...]

USER: {json_of_note_headings_and_previews}
```

#### Stage 6: Embed
- Embed each chunk's text using the configured embedding model
- Store in ChromaDB collection `questions` or `notes`
- ChromaDB metadata: `{ doc_id, tags_json, difficulty, content_type }`

### 9.2 WebSocket Progress Events

Frontend subscribes to `/ws/pipeline/{doc_id}`. Backend emits:

```json
{
  "stage": "extract" | "classify" | "chunk" | "tag" | "embed" | "order" | "done" | "error",
  "progress": 0,
  "message": "Extracted 47 Q&A pairs from 23 pages",
  "details": {
    "chunks_processed": 12,
    "chunks_total": 47,
    "questions_found": 32,
    "notes_found": 15
  }
}
```

### 9.3 AI Client Abstraction

`backend/services/ai_client.py` exposes a single interface:

```python
class AIClient:
    def __init__(self, provider: str, model: str, api_key: str): ...

    async def complete(self, system: str, user: str, json_mode: bool = True) -> str: ...
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
```

Provider routing:
- `"gemini"` → `langchain_google_genai`
- `"groq"` → `langchain_groq`
- `"openai"` → `langchain_openai`

---

## 10. API Design

### 10.1 Base URL
All endpoints at `http://localhost:8765/api/`

### 10.2 Endpoints

#### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/documents/upload` | Upload file (multipart/form-data). Returns `{ doc_id }`. Starts async pipeline. |
| `GET` | `/documents` | List all documents. Returns array with status, tag_summary, counts. |
| `GET` | `/documents/{id}` | Full document detail + item counts + processing log |
| `DELETE` | `/documents/{id}` | Remove document + all extracted content (requires `?confirm=true`) |
| `POST` | `/documents/{id}/reprocess` | Re-run pipeline on existing document (e.g. after changing model) |

#### Questions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/questions` | List questions. Query params: `tags` (repeated, AND logic), `search` (semantic), `difficulty`, `bookmarked`, `doc_id`, `limit`, `offset` |
| `GET` | `/questions/{id}` | Single question with tags and SRS state |
| `PATCH` | `/questions/{id}` | Edit `question_text`, `answer_text`, `bookmarked`, add/remove `tags` |
| `DELETE` | `/questions/{id}` | Delete single question |

#### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/notes` | List note chunks. Query params: `tags` (AND), `search`, `doc_id`, `content_type` |
| `GET` | `/notes/topic/{tag_name}` | All notes for a tag, merged across docs, in `topic_order`. Primary study view endpoint. |
| `PATCH` | `/notes/{id}` | Edit content, add/remove tags |

#### Tags
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tags` | All tags with usage counts. Query params: `type`, `search` |
| `POST` | `/tags` | Create a user custom tag: `{ name, tag_type: "custom" }` |
| `POST` | `/tags/merge` | Merge: `{ source_tag_id, target_tag_id }` — reassigns all item_tags |
| `DELETE` | `/tags/{id}` | Delete tag (only if usage_count == 0, or with `?force=true`) |

#### SRS / Flashcards
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/srs/due` | Questions due for review. Query params: `tags` (AND filter), `limit` |
| `POST` | `/srs/review` | Submit review: `{ question_id, rating: "again"|"hard"|"good"|"easy", response_time_ms }` |
| `GET` | `/srs/stats` | Overall SRS stats: total cards, due today, mastered, learning |
| `POST` | `/srs/session/start` | Create session: `{ tag_filter, session_type }`. Returns `session_id` + first card |
| `POST` | `/srs/session/{id}/end` | End session, returns summary |

#### Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/progress/dashboard` | All dashboard data: streak, heatmap (last 365 days), topic coverage, weak areas |
| `GET` | `/progress/topic/{tag_name}` | Per-topic: questions count, reviewed %, mastered %, note blocks count |

#### Vault (Export / Import)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/vault/export` | `{ tag_ids?: [], doc_ids?: [], passphrase }` → generates `.phvault`, returns file path |
| `POST` | `/vault/import/preview` | `{ file_path }` → returns `meta.json` contents (no passphrase needed) |
| `POST` | `/vault/import` | `{ file_path, passphrase, collision_strategy: "keep_mine"|"keep_theirs"|"keep_both"|"ask" }` |

#### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/settings` | Returns current settings (API keys masked as `***`) |
| `POST` | `/settings` | Save settings. Encrypts API keys before writing to config. |
| `POST` | `/settings/test-key` | Test an API key: `{ provider, api_key }` → returns `{ valid: bool, model_list? }` |

#### WebSocket
| | Endpoint | Description |
|-|----------|-------------|
| `WS` | `/ws/pipeline/{doc_id}` | Real-time pipeline progress for a document |

### 10.3 Standard Response Format

```json
// Success
{ "data": { ... }, "meta": { "total": 100, "limit": 20, "offset": 0 } }

// Error
{ "error": { "code": "TAG_NOT_FOUND", "message": "Tag with id 'xyz' does not exist" } }
```

---

## 11. Export / Import Spec

### 11.1 `.phvault` File Format

A `.phvault` file is a renamed ZIP archive containing exactly two files:

```
bundle.phvault (ZIP)
├── meta.json           ← UNENCRYPTED — safe to preview without passphrase
└── encrypted_content.bin  ← AES-256-GCM encrypted payload
```

### 11.2 `meta.json` (unencrypted)
```json
{
  "version": "1.0",
  "created_at": "2026-06-20T10:00:00Z",
  "created_by_vault_id": "abc123",
  "item_counts": {
    "questions": 42,
    "notes": 28,
    "tags": 15
  },
  "tag_names": ["LangGraph", "RAG", "System Design"],
  "salt_hex": "a3f9...",
  "nonce_hex": "b7e2..."
}
```

### 11.3 Encryption Spec
- **Algorithm:** AES-256-GCM (authenticated — prevents both reading AND tampering)
- **Key Derivation:** PBKDF2-HMAC-SHA256, 600,000 iterations, random 16-byte salt
- **Nonce:** Random 12-byte IV per export
- `encrypted_content.bin` decrypts to `content.json` (UTF-8)

### 11.4 `content.json` (decrypted payload)
```json
{
  "questions": [
    {
      "id": "...",
      "question_text": "...",
      "answer_text": "...",
      "difficulty": "intermediate",
      "tags": ["LangGraph", "State Machine"],
      "srs_state": { "ease_factor": 2.5, "interval_days": 4, "repetitions": 2 }
    }
  ],
  "notes": [ { ... } ],
  "tags": [ { "name": "LangGraph", "tag_type": "tech" } ]
}
```

### 11.5 Collision Resolution
When importing, for each question, check if a question with identical `question_text` already exists:
- **keep_mine:** Skip the incoming item, keep existing
- **keep_theirs:** Overwrite existing with incoming
- **keep_both:** Import as new item regardless
- **ask:** Return list of collisions to frontend for user to resolve one-by-one (UI shows diff)

---

## 12. Project File Structure

```
prep-helper/
│
├── backend/
│   ├── main.py                         # FastAPI app, mounts routers, serves React build
│   ├── config.py                       # Settings loader, vault path, config.json management
│   ├── database.py                     # SQLAlchemy engine + session factory + Chroma client
│   │
│   ├── models/                         # SQLAlchemy ORM models (match schema exactly)
│   │   ├── __init__.py
│   │   ├── document.py
│   │   ├── question.py
│   │   ├── note.py
│   │   ├── tag.py
│   │   └── srs.py
│   │
│   ├── schemas/                        # Pydantic v2 request/response schemas
│   │   ├── __init__.py
│   │   ├── document.py
│   │   ├── question.py
│   │   ├── note.py
│   │   ├── tag.py
│   │   └── srs.py
│   │
│   ├── routers/                        # FastAPI APIRouter — one file per domain
│   │   ├── __init__.py
│   │   ├── documents.py
│   │   ├── questions.py
│   │   ├── notes.py
│   │   ├── tags.py
│   │   ├── srs.py
│   │   ├── progress.py
│   │   ├── vault.py
│   │   ├── settings.py
│   │   └── ws.py                       # WebSocket endpoint
│   │
│   ├── services/
│   │   ├── pipeline/
│   │   │   ├── __init__.py
│   │   │   ├── orchestrator.py         # Async task runner; emits WebSocket events
│   │   │   ├── extractor.py            # MarkItDown + PyMuPDF wrapper
│   │   │   ├── classifier.py           # LLM doc type classification
│   │   │   ├── chunker.py              # Q&A splitter + note semantic chunker
│   │   │   ├── tagger.py               # LLM batch tagging (10 chunks/call)
│   │   │   ├── reorder.py              # Topic ordering LLM call for notes
│   │   │   └── embedder.py             # ChromaDB embedding + upsert
│   │   │
│   │   ├── ai_client.py                # Unified LLM + embedding client (Gemini/Groq/OpenAI)
│   │   ├── srs_service.py              # SM-2 algorithm: calculate next interval from rating
│   │   ├── vault_service.py            # Export/import: ZIP, encrypt, decrypt
│   │   ├── progress_service.py         # Dashboard aggregations, streak, heatmap data
│   │   └── search_service.py           # Semantic search via ChromaDB + merge with SQL results
│   │
│   ├── migrations/                     # Alembic migration scripts
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   │
│   ├── utils/
│   │   ├── crypto.py                   # AES-256-GCM encrypt/decrypt helpers
│   │   ├── tag_vocab.py                # Predefined ~200 tech tag vocabulary list
│   │   └── text_utils.py               # Text cleaning, token counting, markdown helpers
│   │
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # React Router setup + layout shell
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx           # Home: stats cards, due today, recent docs, streak
│   │   │   ├── Upload.jsx              # Drag-drop upload + live pipeline progress viewer
│   │   │   ├── QuestionBank.jsx        # Tag filter bar + question list + detail panel
│   │   │   ├── StudyNotes.jsx          # Topic selector + sequential merged note reader
│   │   │   ├── Flashcards.jsx          # SRS session: flip card UI + rating buttons
│   │   │   ├── Progress.jsx            # Study heatmap + topic coverage + weak areas
│   │   │   ├── TagManager.jsx          # Tag browser, usage counts, merge tool
│   │   │   ├── Documents.jsx           # All uploads list, status, reprocess option
│   │   │   ├── VaultTools.jsx          # Export selector + import drop zone
│   │   │   └── Settings.jsx            # API keys, model selection, vault path
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                     # Design system primitives
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Badge.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Modal.jsx
│   │   │   │   └── Spinner.jsx
│   │   │   │
│   │   │   ├── TagChip.jsx             # Coloured tag pill (type-aware colour mapping)
│   │   │   ├── TagFilter.jsx           # Multi-tag select with AND-logic chip display
│   │   │   ├── QuestionCard.jsx        # Question + answer + tags + bookmark + edit
│   │   │   ├── NoteBlock.jsx           # Note chunk: heading + content + source attribution
│   │   │   ├── PipelineProgress.jsx    # WebSocket-connected stage progress UI
│   │   │   ├── FlashCard.jsx           # 3D flip animation + Again/Hard/Good/Easy buttons
│   │   │   ├── StudyHeatmap.jsx        # GitHub-style calendar heatmap (recharts)
│   │   │   ├── TopicCoverage.jsx       # Per-tag progress bars
│   │   │   └── SourceBadge.jsx         # "From: Filename.pdf" attribution chip
│   │   │
│   │   ├── hooks/
│   │   │   ├── usePipeline.js          # WebSocket connection + event stream for a doc_id
│   │   │   ├── useTags.js              # Fetch tags, filter state management
│   │   │   └── useSRS.js              # Flashcard session state machine (idle/reviewing/done)
│   │   │
│   │   ├── stores/
│   │   │   └── appStore.js             # Zustand: settings loaded?, vault path, active model
│   │   │
│   │   ├── api/
│   │   │   └── client.js               # Axios instance (baseURL: localhost:8765/api) + typed fns
│   │   │
│   │   └── utils/
│   │       ├── tagColors.js            # Tag type → TailwindCSS colour class mapping
│   │       └── formatters.js           # Date formatting, truncation, difficulty labels
│   │
│   ├── index.html
│   ├── vite.config.js                  # Proxy /api → localhost:8765 in dev mode
│   └── package.json
│
├── launcher.py                         # Starts uvicorn, waits for ready, opens browser tab
├── start.sh                            # Unix: chmod +x && ./start.sh
├── start.bat                           # Windows: double-click to launch
├── docker-compose.yml                  # Alternative: docker compose up (no Python install)
├── .env.example                        # DEV only: VAULT_PATH, PORT overrides
└── README.md
```

---

## 13. Implementation Phases

Build in this exact order — each phase is independently testable.

| Phase | Name | Key Deliverables | Est. Effort |
|-------|------|-----------------|------------|
| **0** | Foundation | Repo setup, FastAPI skeleton with CORS, SQLite schema + Alembic initial migration, React+Vite scaffold with routing, Vault setup wizard (first-run), Settings page with BYOK + key test endpoint | ~2 days |
| **1** | Ingestion Pipeline | MarkItDown integration, AI classify+chunk+tag pipeline, WebSocket progress events, ChromaDB setup, Document upload endpoint + Documents page with real-time status | ~4 days |
| **2** | Question Bank | Q&A storage, tag filter with AND logic (SQL), question card UI, bookmark toggle, manual edit, semantic search via Chroma | ~3 days |
| **3** | Study Notes | Note storage, `/notes/topic/{tag}` merged+ordered endpoint, sequential note reader UI, Focus Mode, source attribution badges, topic ordering LLM call | ~3 days |
| **4** | Tag System | Tag Manager page, merge endpoint + UI, tag autocomplete component (used everywhere), colour system, vocabulary seeding on first run | ~2 days |
| **5** | Flashcards + SRS | SM-2 algorithm in `srs_service.py`, SRS card auto-creation on question insert, flashcard flip UI with framer-motion, rating buttons, session flow, due-card dashboard widget | ~3 days |
| **6** | Progress Tracking | Dashboard stats endpoint, study heatmap component, topic coverage bars, weak areas calculation, streak tracker, session history | ~2 days |
| **7** | Export / Import | AES-256-GCM in `crypto.py`, `.phvault` ZIP format, export flow with tag/doc selector, import with preview + collision resolution UI | ~3 days |
| **8** | Polish & QA | Error states everywhere, loading skeletons, empty states (first-time UX), mobile-responsive layout, launcher scripts, README with setup guide | ~2 days |

**Total estimated: ~24 developer-days**

---

## 14. Technology Dependencies

### Backend (`requirements.txt`)

```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
sqlalchemy>=2.0.0
alembic>=1.13.0
chromadb>=0.5.0
markitdown[all]>=0.0.1
PyMuPDF>=1.24.0
langchain>=0.2.0
langchain-google-genai>=1.0.0
langchain-groq>=0.1.0
langchain-openai>=0.1.0
cryptography>=42.0.0
apscheduler>=3.10.0
python-multipart>=0.0.9
pydantic-settings>=2.0.0
pydantic>=2.0.0
aiofiles>=23.0.0
python-dotenv>=1.0.0
```

### Frontend (`package.json` dependencies)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0",
    "axios": "^1.7.0",
    "zustand": "^4.5.0",
    "react-dropzone": "^14.2.0",
    "framer-motion": "^11.2.0",
    "recharts": "^2.12.0",
    "react-hot-toast": "^2.4.0",
    "lucide-react": "^0.383.0",
    "@tanstack/react-query": "^5.45.0",
    "@headlessui/react": "^2.1.0"
  },
  "devDependencies": {
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## 15. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Extraction** | MarkItDown + PyMuPDF fallback | MarkItDown handles all file types uniformly; PyMuPDF gives precise page numbers and better scanned PDF handling |
| **Vector DB** | ChromaDB (local, in-process) | Zero configuration, no separate server, persists to vault folder, rebuildable from SQLite |
| **SRS Algorithm** | SM-2 | Open algorithm, industry standard, validated by Anki over 20 years |
| **Encryption** | AES-256-GCM | Authenticated encryption — prevents both reading AND tampering of exported bundles |
| **State management** | Zustand (not Redux) | Minimal API, no boilerplate, sufficient for this app's complexity |
| **DB** | SQLite | Single file in vault (easily backed up), zero server, sufficient for local use at any scale |
| **AI abstraction** | Custom `ai_client.py` | Single interface across Gemini/Groq/OpenAI — user switches model in settings, no code changes |
| **Tag AND logic** | SQL `GROUP BY` + `HAVING COUNT` | Standard SQL pattern: `WHERE tag_id IN (...) GROUP BY item_id HAVING COUNT(DISTINCT tag_id) = N` |
| **Frontend serving** | Vite builds → FastAPI serves static | User runs ONE process, ONE port. No separate frontend dev server in production. |
| **Config location** | `~/.prephelper/config.json` | Outside vault so vault can be moved/shared without exposing API keys |
| **Source of truth** | SQLite (not ChromaDB) | If Chroma index is corrupted, rebuild from SQLite. Never let Chroma data diverge from SQL. |

---

## 16. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| LLM tagging inaccurate for niche topics | Medium | High | Allow manual tag editing; user can re-process with a more capable model |
| MarkItDown fails on complex PDFs (tables, scanned) | Medium | Medium | PyMuPDF fallback; show extraction confidence score; let user provide text manually |
| AI API rate limits slow bulk processing | Medium | Low | Queue with configurable delay between calls; show ETA; allow pause/resume |
| ChromaDB index corruption on crash | Low | High | Auto-rebuild from SQLite on startup if inconsistency detected |
| Large vault (500+ PDFs) slows queries | Low | Medium | SQL indexes on all filter columns; Chroma handles scale well; pagination on all list endpoints |
| User forgets export passphrase | Medium | High | Clear warning at export time; suggest password manager; no recovery by design (don't store passphrase) |
| MarkItDown produces poor Markdown for image-heavy PDFs | Medium | Medium | Detect low text extraction (< 50 words/page) and warn user; future: OCR fallback |

---

## 17. Future Roadmap (v2+)

### v2 Targets
- **Ollama integration** — fully offline AI via local models (no external API key required)
- **YouTube transcript import** — paste a YouTube URL, transcript is processed as study notes
- **AI quiz mode** — LLM evaluates user's free-text answers, not just flashcard flip
- **Batch re-tagging** — re-run tagger on all existing content when user switches to a better model

### v3 Targets
- **P2P vault sync** — collaborative vaults via invite codes (LAN or via relay)
- **Browser extension** — capture PDFs directly from web/Instagram without leaving the browser
- **Mobile companion** — read-only mobile app that syncs from desktop vault over LAN

---

*Prep Helper — Project Documentation Suite | v1.0 | June 2026*
*All development should follow this document as the single source of truth. Any feature deviations must be documented here before implementation.*
