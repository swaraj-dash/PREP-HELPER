import os
import json
import chromadb
from sqlalchemy import select
from backend.config import load_config
from backend.services.ai_client import AIClient
from backend.models.question import Question
from backend.models.note import Note

_chroma_client = None

def get_chroma_client():
    """Retrieves or instantiates the ChromaDB persistent client pointing to {vault_path}/chroma."""
    global _chroma_client
    if _chroma_client is None:
        config = load_config()
        if not config.vault_path:
            raise ValueError("[Embedder] Vault path is not configured yet in config.")
        chroma_dir = os.path.join(config.vault_path, "chroma")
        os.makedirs(chroma_dir, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=chroma_dir)
    return _chroma_client


def get_collection(name: str):
    """Retrieves or creates a ChromaDB vector store collection by name ('questions' or 'notes')."""
    client = get_chroma_client()
    return client.get_or_create_collection(name=name)


async def embed_questions(questions: list[Question], ai_client: AIClient, db_session):
    """Batches and embeds question objects, indexing them into the questions Chroma collection.
    
    Args:
        questions (list[Question]): SQL question models.
        ai_client (AIClient): Configured AI client wrapper.
        db_session (AsyncSession): SQL database session.
    """
    if not questions:
        return

    q_ids = [q.id for q in questions]

    # Resolve associated tags names to store in vector metadata for filtered queries
    from backend.models.tag import Tag, ItemTag
    tag_map = {}
    if q_ids:
        stmt = (
            select(ItemTag.item_id, Tag.name)
            .join(Tag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_type == "question", ItemTag.item_id.in_(q_ids))
        )
        result = await db_session.execute(stmt)
        for item_id, tag_name in result.all():
            if item_id not in tag_map:
                tag_map[item_id] = []
            tag_map[item_id].append(tag_name)

    collection = get_collection("questions")
    batch_size = 10

    for i in range(0, len(questions), batch_size):
        batch = questions[i : i + batch_size]
        texts = [f"Q: {q.question_text}\nA: {q.answer_text}" for q in batch]
        
        # Call active provider to generate float vectors
        embeddings = await ai_client.embed(texts)

        ids = [q.id for q in batch]
        metadatas = []
        for q in batch:
            tags_list = tag_map.get(q.id, [])
            metadatas.append({
                "doc_id": q.document_id,
                "difficulty": q.difficulty or "intermediate",
                "tags": json.dumps(tags_list)
            })

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )

    print(f"[Embedder] Successfully indexed {len(questions)} questions in ChromaDB.")


async def embed_notes(notes: list[Note], ai_client: AIClient, db_session):
    """Batches and embeds note objects, indexing them into the notes Chroma collection.
    
    Args:
        notes (list[Note]): SQL note models.
        ai_client (AIClient): Configured AI client wrapper.
        db_session (AsyncSession): SQL database session.
    """
    if not notes:
        return

    n_ids = [n.id for n in notes]

    # Resolve associated tags names
    from backend.models.tag import Tag, ItemTag
    tag_map = {}
    if n_ids:
        stmt = (
            select(ItemTag.item_id, Tag.name)
            .join(Tag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_type == "note", ItemTag.item_id.in_(n_ids))
        )
        result = await db_session.execute(stmt)
        for item_id, tag_name in result.all():
            if item_id not in tag_map:
                tag_map[item_id] = []
            tag_map[item_id].append(tag_name)

    collection = get_collection("notes")
    batch_size = 10

    for i in range(0, len(notes), batch_size):
        batch = notes[i : i + batch_size]
        texts = [f"{n.heading or ''}\n{n.content}" for n in batch]
        
        embeddings = await ai_client.embed(texts)

        ids = [n.id for n in batch]
        metadatas = []
        for n in batch:
            tags_list = tag_map.get(n.id, [])
            metadatas.append({
                "doc_id": n.document_id,
                "content_type": n.content_type or "concept",
                "tags": json.dumps(tags_list)
            })

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas
        )

    print(f"[Embedder] Successfully indexed {len(notes)} notes in ChromaDB.")


async def rebuild_index(db_session, ai_client: AIClient):
    """Rebuilds the Chroma vector store index completely by reading all records from SQL database.
    Useful for resolving inconsistencies or restoring local state on new machines.
    """
    print("[Embedder] Rebuilding Chroma vector indices from SQL database...")
    
    # 1. Reset collections
    client = get_chroma_client()
    try:
        client.delete_collection("questions")
    except Exception:
        pass
    try:
        client.delete_collection("notes")
    except Exception:
        pass

    # 2. Query and re-embed all questions
    stmt_q = select(Question)
    res_q = await db_session.execute(stmt_q)
    all_questions = list(res_q.scalars().all())
    await embed_questions(all_questions, ai_client, db_session)

    # 3. Query and re-embed all notes
    stmt_n = select(Note)
    res_n = await db_session.execute(stmt_n)
    all_notes = list(res_n.scalars().all())
    await embed_notes(all_notes, ai_client, db_session)

    print("[Embedder] Index rebuild completed successfully.")
