import os
import json
import traceback
from datetime import datetime
from sqlalchemy import select
from backend.database import get_sessionmaker
from backend.models.document import Document
from backend.models.question import Question
from backend.models.note import Note
from backend.models.tag import Tag, ItemTag
from backend.models.srs import SRSCard
from backend.services.ai_client import get_ai_client
from backend.services.pipeline.extractor import extract_to_markdown
from backend.services.pipeline.classifier import classify_document
from backend.services.pipeline.chunker import chunk_document
from backend.services.pipeline.tagger import tag_chunks
from backend.services.pipeline.embedder import embed_questions, embed_notes
from backend.services.pipeline.reorder import reorder_notes_for_topic
from backend.routers.ws import manager

async def run_pipeline(doc_id: str, file_path: str, original_name: str):
    """Executes the asynchronous document ingestion pipeline.
    Progresses through: Extract -> Classify -> Chunk -> Tag -> Embed -> Reorder -> Done.
    Updates the document entity state in SQLite and broadcasts real-time updates via WebSocket.
    """
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as db:
        # Load target document record
        stmt = select(Document).where(Document.id == doc_id)
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if not doc:
            print(f"[Orchestrator] Document ID '{doc_id}' not found in database.")
            return

        try:
            ai_client = get_ai_client("extraction")
        except Exception as e:
            # Raise configuration warning if no keys are loaded
            doc.status = "error"
            doc.error_message = f"AI integration configuration error: {str(e)}"
            await db.commit()
            await manager.send_event(doc_id, {
                "stage": "error",
                "progress": 100,
                "message": doc.error_message,
                "details": {}
            })
            return

        try:
            # --- STAGE 1: EXTRACT ---
            doc.status = "extracting"
            await db.commit()
            await manager.send_event(doc_id, {
                "stage": "extracting",
                "progress": 10,
                "message": "Extracting text structure...",
                "details": {}
            })

            cleaned_text, page_count = extract_to_markdown(file_path)
            doc.page_count = page_count
            await db.commit()

            if not cleaned_text.strip():
                raise ValueError("Extracted text is empty or document format is unsupported.")

            # --- STAGE 2: CLASSIFY ---
            doc.status = "classifying"
            await db.commit()
            await manager.send_event(doc_id, {
                "stage": "classifying",
                "progress": 25,
                "message": "Determining document structure (Q&A heavy vs Notes heavy)...",
                "details": {}
            })

            classification = await classify_document(cleaned_text, ai_client)
            doc_type = classification.get("type", "MIXED")
            doc.doc_type = doc_type
            await db.commit()

            # --- STAGE 3: CHUNK ---
            doc.status = "chunking"
            await db.commit()
            await manager.send_event(doc_id, {
                "stage": "chunking",
                "progress": 40,
                "message": f"Splitting text content into chunks ({doc_type})...",
                "details": {}
            })

            qa_chunks, note_chunks = await chunk_document(cleaned_text, doc_type, ai_client)
            doc.chunk_count = len(qa_chunks) + len(note_chunks)
            await db.commit()

            # --- STAGE 4: TAG ---
            doc.status = "tagging"
            await db.commit()
            await manager.send_event(doc_id, {
                "stage": "tagging",
                "progress": 60,
                "message": f"Assigning tags: {len(qa_chunks)} questions, {len(note_chunks)} notes...",
                "details": {
                    "chunks_processed": 0,
                    "chunks_total": len(qa_chunks) + len(note_chunks),
                    "questions_found": len(qa_chunks),
                    "notes_found": len(note_chunks)
                }
            })

            # Fetch LLM tagged arrays
            qa_tagged = await tag_chunks(qa_chunks, "qa", ai_client, db)
            note_tagged = await tag_chunks(note_chunks, "note", ai_client, db)

            # Insert Questions & SRS Cards
            q_mappings = []
            for idx, c in enumerate(qa_tagged):
                q = Question(
                    document_id=doc_id,
                    question_text=c["q"],
                    answer_text=c["a"],
                    difficulty=c.get("difficulty", "intermediate"),
                    order_in_doc=idx
                )
                db.add(q)
                q_mappings.append((q, c["resolved_tags"]))

            await db.flush()

            for q, tags in q_mappings:
                # Add associated SRS learning card
                srs = SRSCard(
                    question_id=q.id,
                    ease_factor=2.5,
                    interval_days=0,
                    due_date=datetime.utcnow(),
                    repetitions=0
                )
                db.add(srs)
                
                # Add item tag mappings
                for t in tags:
                    item_tag = ItemTag(item_type="question", item_id=q.id, tag_id=t.id)
                    db.add(item_tag)
                    t.usage_count += 1

            # Insert Note chunks
            n_mappings = []
            for idx, c in enumerate(note_tagged):
                n = Note(
                    document_id=doc_id,
                    heading=c.get("heading"),
                    content=c["content"],
                    content_type=c.get("content_type", "concept"),
                    order_index=c.get("position", idx),
                    topic_order=c.get("position", idx)
                )
                db.add(n)
                n_mappings.append((n, c["resolved_tags"]))

            await db.flush()

            for n, tags in n_mappings:
                for t in tags:
                    item_tag = ItemTag(item_type="note", item_id=n.id, tag_id=t.id)
                    db.add(item_tag)
                    t.usage_count += 1

            await db.commit()

            # --- STAGE 5: EMBED ---
            doc.status = "embedding"
            await db.commit()
            await manager.send_event(doc_id, {
                "stage": "embedding",
                "progress": 80,
                "message": "Generating vector store embeddings index...",
                "details": {
                    "chunks_processed": len(qa_chunks) + len(note_chunks),
                    "chunks_total": len(qa_chunks) + len(note_chunks),
                    "questions_found": len(qa_chunks),
                    "notes_found": len(note_chunks)
                }
            })

            just_questions = [q for q, _ in q_mappings]
            just_notes = [n for n, _ in n_mappings]

            await embed_questions(just_questions, ai_client, db)
            await embed_notes(just_notes, ai_client, db)

            # --- STAGE 6: REORDER ---
            unique_note_tags = set()
            for _, tags in n_mappings:
                for t in tags:
                    unique_note_tags.add(t.name)

            if unique_note_tags:
                await manager.send_event(doc_id, {
                    "stage": "embedding",
                    "progress": 90,
                    "message": f"Organizing sequence order for {len(unique_note_tags)} concept topics...",
                    "details": {
                        "chunks_processed": len(qa_chunks) + len(note_chunks),
                        "chunks_total": len(qa_chunks) + len(note_chunks),
                        "questions_found": len(qa_chunks),
                        "notes_found": len(note_chunks)
                    }
                })
                # Trigger cross-doc sequencing
                for tag_name in unique_note_tags:
                    await reorder_notes_for_topic(tag_name, db, ai_client)

            # --- STAGE 7: DONE ---
            doc.status = "done"
            doc.question_count = len(qa_chunks)
            doc.note_count = len(note_chunks)

            # Construct top tag names summary
            freq = {}
            for _, tags in q_mappings + n_mappings:
                for t in tags:
                    freq[t.name] = freq.get(t.name, 0) + 1
            sorted_tags = sorted(freq.keys(), key=lambda x: freq[x], reverse=True)[:5]
            doc.tag_summary = json.dumps(sorted_tags)

            await db.commit()

            await manager.send_event(doc_id, {
                "stage": "done",
                "progress": 100,
                "message": f"Ingestion completed. Extracted {len(qa_chunks)} Q&As and {len(note_chunks)} notes.",
                "details": {
                    "chunks_processed": len(qa_chunks) + len(note_chunks),
                    "chunks_total": len(qa_chunks) + len(note_chunks),
                    "questions_found": len(qa_chunks),
                    "notes_found": len(note_chunks)
                }
            })
            print(f"[Orchestrator] Document '{original_name}' pipeline successfully processed.")

        except Exception as e:
            traceback.print_exc()
            print(f"[Orchestrator] Document pipeline failed: {e}")
            doc.status = "error"
            doc.error_message = str(e)
            await db.commit()

            await manager.send_event(doc_id, {
                "stage": "error",
                "progress": 100,
                "message": f"Processing failed: {str(e)}",
                "details": {}
            })
