import json
from sqlalchemy import select
from backend.models.note import Note
from backend.models.tag import Tag, ItemTag
from backend.services.ai_client import AIClient
from backend.services.pipeline.classifier import clean_json_response

async def reorder_notes_for_topic(tag_name: str, db_session, ai_client: AIClient):
    """Reorders note chunks tagged with the given tag_name across multiple documents.
    Updates the 'topic_order' field in the database based on LLM logical sequence sorting.
    """
    # Query for all notes carrying this topic tag
    stmt = (
        select(Note)
        .join(ItemTag, ItemTag.item_id == Note.id)
        .join(Tag, ItemTag.tag_id == Tag.id)
        .where(ItemTag.item_type == "note", Tag.name == tag_name)
    )
    result = await db_session.execute(stmt)
    notes = list(result.scalars().all())

    # Skip reordering if there are fewer than 3 notes
    if len(notes) < 3:
        for n in notes:
            n.topic_order = n.order_index
        await db_session.commit()
        return

    # Build sequence evaluation payload
    payload = []
    for n in notes:
        payload.append({
            "id": n.id,
            "heading": n.heading or "Section Details",
            "content_preview": n.content[:200]
        })

    system_prompt = (
        "Reorder these study note sections into the most logical learning sequence, from fundamentals to advanced.\n"
        "Return ONLY a JSON array of string IDs in the correct sorted order: "
        '["id1", "id2", ...]. Do not include markdown formatting or explanations.'
    )
    user_prompt = json.dumps(payload, indent=2)

    try:
        response_text = await ai_client.complete(
            system=system_prompt,
            user=user_prompt,
            json_mode=True
        )
        cleaned = clean_json_response(response_text)
        sorted_ids = json.loads(cleaned)

        if isinstance(sorted_ids, list):
            id_to_order = {note_id: idx for idx, note_id in enumerate(sorted_ids)}
            for n in notes:
                # Update sorting index order; fallback to original file order if LLM missed any note
                n.topic_order = id_to_order.get(n.id, n.order_index)
            
            await db_session.commit()
            print(f"[Reorderer] Reordered {len(notes)} notes for tag: '{tag_name}'")
    except Exception as e:
        print(f"[Reorderer] Failed notes ordering for tag '{tag_name}': {e}. Falling back to default order_index.")
        for n in notes:
            n.topic_order = n.order_index
        await db_session.commit()
