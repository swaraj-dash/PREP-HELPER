import json
import re
from sqlalchemy import select
from backend.models.tag import Tag
from backend.services.ai_client import AIClient
from backend.utils.tag_vocab import TAG_VOCABULARY
from backend.services.pipeline.classifier import clean_json_response

async def tag_chunks(chunks: list[dict], chunk_type: str, ai_client: AIClient, db_session) -> list[dict]:
    """Assigns tags and difficulty levels to a list of question or note chunks in batches of 10.
    Persists newly identified tags in the database.
    
    Args:
        chunks (list[dict]): List of Q&A or Note dict chunks.
        chunk_type (str): Either "qa" or "note".
        ai_client (AIClient): Configured AI provider wrapper.
        db_session (AsyncSession): SQL database session.
    
    Returns:
        list[dict]: Chunks with populated 'tags' (list[str]), 'resolved_tags' (list[Tag]), and 'difficulty'.
    """
    if not chunks:
        return []

    # Select the first 80 tags from vocabulary to use as suggestion guidance in LLM system prompt
    vocab_tags = [t["name"] for t in TAG_VOCABULARY[:80]]
    vocab_str = ", ".join(vocab_tags)

    system_prompt = (
        "You are a technical content tagger. Given content chunks, assign relevant tags and estimate their technical difficulty.\n"
        f"Predefined Vocabulary (prioritize these where applicable, but you may create new ones if necessary):\n{vocab_str}\n\n"
        "Return ONLY a JSON array containing one object per input chunk, in the exact same order:\n"
        '[{"id": <idx>, "tags": ["tag1", "tag2"], "difficulty": "beginner"|"intermediate"|"advanced"}, ...]\n'
        "Do not include markdown tags, no explanations, no formatting preamble."
    )

    batch_size = 10
    tagged_chunks = []

    # Assign temporary ids to safely map async batch completions
    for idx, c in enumerate(chunks):
        c["temp_id"] = idx

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        payload = []

        for c in batch:
            if chunk_type == "qa":
                text_content = f"Question: {c.get('q')}\nAnswer: {c.get('a')}"
            else:
                text_content = f"Heading: {c.get('heading')}\nContent: {c.get('content')}"
            payload.append({
                "id": c["temp_id"],
                "text": text_content[:1500]  # Cap text segment length to prevent exceeding token limits
            })

        user_prompt = f"Tag these chunks:\n{json.dumps(payload, indent=2)}"

        try:
            response_text = await ai_client.complete(
                system=system_prompt,
                user=user_prompt,
                json_mode=True
            )
            cleaned = clean_json_response(response_text)
            
            # Simple check in case it's not a JSON list
            if cleaned.startswith("{") and not cleaned.startswith("["):
                cleaned = f"[{cleaned}]"

            llm_results = json.loads(cleaned)
            results_map = {}

            if isinstance(llm_results, list):
                for r in llm_results:
                    c_id = r.get("id")
                    if c_id is not None:
                        results_map[int(c_id)] = {
                            "tags": [t.strip() for t in r.get("tags", []) if t.strip()],
                            "difficulty": r.get("difficulty", "intermediate").lower()
                        }

            for c in batch:
                r = results_map.get(c["temp_id"], {"tags": [], "difficulty": "intermediate"})
                c["tags"] = r["tags"]
                # Normalize difficulty
                difficulty = r["difficulty"]
                if difficulty not in ["beginner", "intermediate", "advanced"]:
                    difficulty = "intermediate"
                c["difficulty"] = difficulty
                tagged_chunks.append(c)

        except Exception as e:
            print(f"[Tagger] Batched tagging failed at index range {i}-{i+batch_size}: {e}")
            for c in batch:
                c["tags"] = []
                c["difficulty"] = "intermediate"
                tagged_chunks.append(c)

    # Collect and resolve unique tag tags against database
    unique_tag_names = set()
    for c in tagged_chunks:
        for t in c["tags"]:
            unique_tag_names.add(t)

    if unique_tag_names:
        # Load existing tags matching the names
        stmt = select(Tag).where(Tag.name.in_(list(unique_tag_names)))
        result = await db_session.execute(stmt)
        existing_tags = {t.name.lower(): t for t in result.scalars().all()}

        vocab_map = {v["name"].lower(): v for v in TAG_VOCABULARY}
        db_tags = {}

        for name in unique_tag_names:
            name_lower = name.lower()
            if name_lower in existing_tags:
                db_tags[name_lower] = existing_tags[name_lower]
            else:
                # Determine tag_type: custom, tech, concept, etc.
                tag_type = "concept"
                vocab_item = vocab_map.get(name_lower)
                if vocab_item:
                    tag_type = vocab_item["tag_type"]
                    # Capitalize matching vocabulary correctly
                    name = vocab_item["name"]

                new_tag = Tag(name=name, tag_type=tag_type, usage_count=0)
                db_session.add(new_tag)
                db_tags[name_lower] = new_tag

        await db_session.flush()

        # Link Tag entities to chunks
        for c in tagged_chunks:
            resolved = []
            for t_name in c["tags"]:
                tag_obj = db_tags.get(t_name.lower())
                if tag_obj:
                    resolved.append(tag_obj)
            c["resolved_tags"] = resolved
    else:
        for c in tagged_chunks:
            c["resolved_tags"] = []

    # Remove temporary ID fields
    for c in tagged_chunks:
        c.pop("temp_id", None)

    return tagged_chunks
