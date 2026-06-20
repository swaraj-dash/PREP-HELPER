import os
import json
import uuid
import zipfile
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.document import Document
from backend.models.question import Question
from backend.models.note import Note
from backend.models.tag import Tag, ItemTag
from backend.models.srs import SRSCard, SRSReview
from backend.utils.crypto import encrypt_vault_payload, decrypt_vault_payload
from backend.config import load_config

async def export_vault(
    tag_ids: list[str] | None,
    doc_ids: list[str] | None,
    passphrase: str,
    db: AsyncSession,
    output_dir: str
) -> str:
    """Exports filtered questions, notes, and tags into a passphrase-encrypted .phvault archive."""
    # 1. Fetch vault metadata / generate ID if missing
    config = load_config()
    vault_path = config.vault_path
    if not vault_path:
        raise ValueError("Vault is not configured.")
    
    meta_file = os.path.join(vault_path, ".prephelper_meta.json")
    vault_id = "unknown_vault"
    if os.path.exists(meta_file):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta_data = json.load(f)
            if "vault_id" not in meta_data:
                meta_data["vault_id"] = str(uuid.uuid4())
                with open(meta_file, "w", encoding="utf-8") as f:
                    json.dump(meta_data, f, indent=4)
            vault_id = meta_data["vault_id"]
        except Exception:
            pass

    # 2. Query questions matching filters
    q_stmt = select(Question)
    if doc_ids:
        q_stmt = q_stmt.where(Question.document_id.in_(doc_ids))
    if tag_ids:
        q_stmt = q_stmt.join(
            ItemTag, 
            (ItemTag.item_id == Question.id) & (ItemTag.item_type == "question")
        ).where(ItemTag.tag_id.in_(tag_ids))
    
    q_res = await db.execute(q_stmt)
    questions = q_res.scalars().all()

    # 3. Query notes matching filters
    n_stmt = select(Note)
    if doc_ids:
        n_stmt = n_stmt.where(Note.document_id.in_(doc_ids))
    if tag_ids:
        n_stmt = n_stmt.join(
            ItemTag, 
            (ItemTag.item_id == Note.id) & (ItemTag.item_type == "note")
        ).where(ItemTag.tag_id.in_(tag_ids))
    
    n_res = await db.execute(n_stmt)
    notes = n_res.scalars().all()

    # 4. Fetch tag associations for selected questions and notes
    all_item_ids = [q.id for q in questions] + [n.id for n in notes]
    tags_map = {}
    all_tag_names = set()
    
    if all_item_ids:
        t_stmt = (
            select(ItemTag.item_type, ItemTag.item_id, Tag.name)
            .join(Tag, ItemTag.tag_id == Tag.id)
            .where(ItemTag.item_id.in_(all_item_ids))
        )
        t_res = await db.execute(t_stmt)
        for row in t_res.all():
            key = (row.item_type, row.item_id)
            if key not in tags_map:
                tags_map[key] = []
            tags_map[key].append(row.name)
            all_tag_names.add(row.name)

    # 5. Fetch SRS card states for selected questions
    srs_map = {}
    q_ids = [q.id for q in questions]
    if q_ids:
        srs_stmt = select(SRSCard).where(SRSCard.question_id.in_(q_ids))
        srs_res = await db.execute(srs_stmt)
        for card in srs_res.scalars().all():
            srs_map[card.question_id] = {
                "ease_factor": card.ease_factor,
                "interval_days": card.interval_days,
                "repetitions": card.repetitions
            }

    # 6. Fetch Tag models for definitions list in content.json
    tag_defs = []
    if all_tag_names:
        tag_def_stmt = select(Tag).where(Tag.name.in_(list(all_tag_names)))
        tag_def_res = await db.execute(tag_def_stmt)
        for t in tag_def_res.scalars().all():
            tag_defs.append({
                "name": t.name,
                "tag_type": t.tag_type
            })

    # 7. Construct content.json data structure
    content_payload = {
        "questions": [],
        "notes": [],
        "tags": tag_defs
    }

    for q in questions:
        content_payload["questions"].append({
            "id": q.id,
            "question_text": q.question_text,
            "answer_text": q.answer_text,
            "difficulty": q.difficulty,
            "source_page": q.source_page,
            "order_in_doc": q.order_in_doc,
            "bookmarked": q.bookmarked,
            "tags": tags_map.get(("question", q.id), []),
            "srs_state": srs_map.get(q.id, None)
        })

    for n in notes:
        content_payload["notes"].append({
            "id": n.id,
            "heading": n.heading,
            "content": n.content,
            "content_type": n.content_type,
            "order_index": n.order_index,
            "topic_order": n.topic_order,
            "tags": tags_map.get(("note", n.id), [])
        })

    # 8. Encrypt payload
    content_bytes = json.dumps(content_payload, ensure_ascii=False).encode("utf-8")
    ciphertext, nonce, salt = encrypt_vault_payload(content_bytes, passphrase)

    # 9. Construct meta.json
    meta_data = {
        "version": "1.0",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "created_by_vault_id": vault_id,
        "item_counts": {
            "questions": len(content_payload["questions"]),
            "notes": len(content_payload["notes"]),
            "tags": len(content_payload["tags"])
        },
        "tag_names": sorted(list(all_tag_names)),
        "salt_hex": salt.hex(),
        "nonce_hex": nonce.hex()
    }

    # 10. Write zip file to exports path
    os.makedirs(output_dir, exist_ok=True)
    filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}-export.phvault"
    zip_path = os.path.join(output_dir, filename)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("meta.json", json.dumps(meta_data, indent=4))
        z.writestr("encrypted_content.bin", ciphertext)

    return zip_path


def preview_vault(file_path: str) -> dict:
    """Opens a .phvault file and extracts its unencrypted metadata (meta.json) payload."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Vault export file not found at: {file_path}")
    
    try:
        with zipfile.ZipFile(file_path, "r") as z:
            meta_bytes = z.read("meta.json")
            return json.loads(meta_bytes.decode("utf-8"))
    except Exception as e:
        raise ValueError(f"Invalid or corrupted vault file: {str(e)}")


async def import_vault(
    file_path: str,
    passphrase: str,
    collision_strategy: str,
    db: AsyncSession
) -> dict:
    """Decrypts, validates, and imports questions, notes, and tags from a .phvault archive."""
    # 1. Preview file to get metadata
    meta = preview_vault(file_path)
    salt = bytes.fromhex(meta["salt_hex"])
    nonce = bytes.fromhex(meta["nonce_hex"])

    # 2. Decrypt encrypted content
    with zipfile.ZipFile(file_path, "r") as z:
        ciphertext = z.read("encrypted_content.bin")

    try:
        decrypted_bytes = decrypt_vault_payload(ciphertext, nonce, salt, passphrase)
    except Exception:
        raise ValueError("Decryption failed. Invalid passphrase or corrupted payload.")

    content = json.loads(decrypted_bytes.decode("utf-8"))

    # 3. Create Virtual import document log
    import_filename = os.path.basename(file_path)
    doc_id = str(uuid.uuid4())
    import_doc = Document(
        id=doc_id,
        filename=import_filename,
        original_name=import_filename,
        file_type="vault",
        status="done"
    )
    db.add(import_doc)
    await db.flush()

    # 4. Import & map Tag definitions
    tag_name_to_id = {}
    
    # Pre-populate map with existing tags in db
    existing_tags_res = await db.execute(select(Tag))
    for tag in existing_tags_res.scalars().all():
        tag_name_to_id[tag.name] = tag.id

    for t in content.get("tags", []):
        t_name = t["name"]
        if t_name not in tag_name_to_id:
            new_tag_id = str(uuid.uuid4())
            new_tag = Tag(
                id=new_tag_id,
                name=t_name,
                tag_type=t.get("tag_type", "custom"),
                usage_count=0
            )
            db.add(new_tag)
            tag_name_to_id[t_name] = new_tag_id
    
    await db.flush()

    imported_count = 0
    skipped_count = 0
    collisions = []

    # 5. Process Questions
    now = datetime.utcnow()
    for q in content.get("questions", []):
        q_text = q["question_text"]
        
        # Check if identical question_text exists in DB
        exists_stmt = select(Question).where(Question.question_text == q_text)
        exists_res = await db.execute(exists_stmt)
        existing_q = exists_res.scalar_one_or_none()
        
        target_q = None
        is_collision = existing_q is not None
        
        if is_collision:
            collisions.append({
                "question_text": q_text,
                "incoming_answer": q["answer_text"],
                "existing_answer": existing_q.answer_text
            })
            
            if collision_strategy == "keep_mine":
                skipped_count += 1
                continue
            elif collision_strategy == "keep_theirs":
                # Overwrite existing question
                target_q = existing_q
                target_q.answer_text = q["answer_text"]
                target_q.difficulty = q["difficulty"]
                target_q.source_page = q["source_page"]
                target_q.order_in_doc = q["order_in_doc"]
                target_q.bookmarked = q["bookmarked"]
                target_q.updated_at = now
                
                # Clear existing tags for this question
                del_tag_stmt = (
                    ItemTag.__table__.delete()
                    .where((ItemTag.item_id == target_q.id) & (ItemTag.item_type == "question"))
                )
                await db.execute(del_tag_stmt)
            else:  # "keep_both"
                target_q = Question(
                    id=str(uuid.uuid4()),
                    document_id=doc_id,
                    question_text=q_text,
                    answer_text=q["answer_text"],
                    difficulty=q["difficulty"],
                    source_page=q["source_page"],
                    order_in_doc=q["order_in_doc"],
                    bookmarked=q["bookmarked"]
                )
                db.add(target_q)
        else:
            target_q = Question(
                id=str(uuid.uuid4()),
                document_id=doc_id,
                question_text=q_text,
                answer_text=q["answer_text"],
                difficulty=q["difficulty"],
                source_page=q["source_page"],
                order_in_doc=q["order_in_doc"],
                bookmarked=q["bookmarked"]
            )
            db.add(target_q)
            
        await db.flush()
        
        # Link tags to question
        for tag_name in q.get("tags", []):
            t_id = tag_name_to_id.get(tag_name)
            if t_id:
                db.add(ItemTag(item_type="question", item_id=target_q.id, tag_id=t_id))
                tag_stmt = select(Tag).where(Tag.id == t_id)
                tag_res = await db.execute(tag_stmt)
                tag_obj = tag_res.scalar_one_or_none()
                if tag_obj:
                    tag_obj.usage_count += 1

        # Link/Update SRS Card
        srs = q.get("srs_state")
        
        existing_card = None
        if is_collision and collision_strategy == "keep_theirs":
            srs_stmt = select(SRSCard).where(SRSCard.question_id == target_q.id)
            srs_res = await db.execute(srs_stmt)
            existing_card = srs_res.scalar_one_or_none()
            
        ease_factor = 2.5
        interval_days = 0
        repetitions = 0
        
        if srs:
            ease_factor = srs.get("ease_factor", 2.5)
            interval_days = srs.get("interval_days", 0)
            repetitions = srs.get("repetitions", 0)
            
        due_date = now
        if interval_days > 0:
            due_date = now + timedelta(days=interval_days)
            
        if existing_card:
            existing_card.ease_factor = ease_factor
            existing_card.interval_days = interval_days
            existing_card.repetitions = repetitions
            existing_card.due_date = due_date
        else:
            new_card = SRSCard(
                id=str(uuid.uuid4()),
                question_id=target_q.id,
                ease_factor=ease_factor,
                interval_days=interval_days,
                repetitions=repetitions,
                due_date=due_date
            )
            db.add(new_card)
        
        imported_count += 1

    # 6. Process Notes
    for n in content.get("notes", []):
        new_n = Note(
            id=str(uuid.uuid4()),
            document_id=doc_id,
            heading=n.get("heading"),
            content=n["content"],
            content_type=n.get("content_type"),
            order_index=n.get("order_index"),
            topic_order=n.get("topic_order")
        )
        db.add(new_n)
        await db.flush()
        
        # Link tags to note
        for tag_name in n.get("tags", []):
            t_id = tag_name_to_id.get(tag_name)
            if t_id:
                db.add(ItemTag(item_type="note", item_id=new_n.id, tag_id=t_id))
                tag_stmt = select(Tag).where(Tag.id == t_id)
                tag_res = await db.execute(tag_stmt)
                tag_obj = tag_res.scalar_one_or_none()
                if tag_obj:
                    tag_obj.usage_count += 1

    await db.commit()
    
    # 7. Batch Embed imported items
    try:
        from backend.services.ai_client import get_ai_client
        from backend.services.pipeline.embedder import embed_questions, embed_notes
        
        ai_client = get_ai_client("reasoning")
        
        # Query newly added questions
        q_embed_stmt = select(Question).where(Question.document_id == doc_id)
        q_embed_res = await db.execute(q_embed_stmt)
        imported_questions = q_embed_res.scalars().all()
        if imported_questions:
            await embed_questions(imported_questions, ai_client, db)
            
        # Query newly added notes
        n_embed_stmt = select(Note).where(Note.document_id == doc_id)
        n_embed_res = await db.execute(n_embed_stmt)
        imported_notes = n_embed_res.scalars().all()
        if imported_notes:
            await embed_notes(imported_notes, ai_client, db)
    except Exception as e:
        print(f"[Import] Vector embedding insertion failed: {e}")

    return {
        "imported": imported_count,
        "skipped": skipped_count,
        "collisions": collisions
    }
