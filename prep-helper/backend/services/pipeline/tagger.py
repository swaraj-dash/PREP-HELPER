import json
import re
import asyncio
from sqlalchemy import select
from backend.models.tag import Tag
from backend.services.ai_client import AIClient
from backend.utils.tag_vocab import TAG_VOCABULARY
from backend.services.pipeline.classifier import clean_json_response

async def tag_chunks(chunks: list[dict], chunk_type: str, ai_client: AIClient, db_session) -> list[dict]:
    """Assigns tags and difficulty levels to a list of question or note chunks in batches of 4.
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

    # Select the first 25 tags from vocabulary to use as suggestion guidance in LLM system prompt (saves tokens)
    vocab_tags = [t["name"] for t in TAG_VOCABULARY[:25]]
    vocab_str = ", ".join(vocab_tags)

    system_prompt = (
        "You are a technical content tagger. Given content chunks, assign relevant tags (such as programming languages, technologies, concepts, e.g. 'Java', 'Object-Oriented Programming') and estimate technical difficulty.\n"
        f"Predefined Vocabulary (use these if they are directly relevant, but you should create new, specific tags like 'Java', 'Spring Boot', 'Variables', etc. if they describe the content better):\n{vocab_str}\n\n"
        "Return ONLY a JSON array containing one object per input chunk, in the exact same order:\n"
        '[{"id": <idx>, "tags": ["tag1", "tag2"], "difficulty": "beginner"|"intermediate"|"advanced"}, ...]\n'
        "Do not include markdown tags, no explanations, no formatting preamble."
    )

    batch_size = 4
    tagged_chunks = []

    # Assign temporary ids to safely map async batch completions
    for idx, c in enumerate(chunks):
        c["temp_id"] = idx

    for i in range(0, len(chunks), batch_size):
        # Respect rate limits on free tiers
        if i > 0:
            await asyncio.sleep(2.0)

        batch = chunks[i : i + batch_size]
        payload = []

        for c in batch:
            if chunk_type == "qa":
                text_content = f"Question: {c.get('q')}\nAnswer: {c.get('a')}"
            else:
                text_content = f"Heading: {c.get('heading')}\nContent: {c.get('content')}"
            payload.append({
                "id": c["temp_id"],
                "text": text_content[:800]  # Cap text segment length to prevent exceeding token limits
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
            
            # Robust check in case LLM wraps array in a dictionary (e.g. {"chunks": [...]})
            if isinstance(llm_results, dict):
                for key in ["chunks", "results", "data", "items", "array", "tagged_chunks"]:
                    if key in llm_results and isinstance(llm_results[key], list):
                        llm_results = llm_results[key]
                        break
                else:
                    # If it's a single dictionary representing one chunk
                    if "id" in llm_results or "tags" in llm_results:
                        llm_results = [llm_results]

            results_map = {}

            if isinstance(llm_results, list):
                # Try to map by matching ID if present
                for r in llm_results:
                    c_id = r.get("id")
                    if c_id is not None:
                        try:
                            results_map[int(c_id)] = {
                                "tags": [t.strip() for t in r.get("tags", []) if t.strip()],
                                "difficulty": r.get("difficulty", "intermediate").lower()
                            }
                        except (ValueError, TypeError):
                            pass

                # Positional mapping fallback if some temp_ids are missing and array lengths match
                if len(results_map) < len(batch) and len(llm_results) == len(batch):
                    for idx, c in enumerate(batch):
                        temp_id = c["temp_id"]
                        if temp_id not in results_map:
                            r = llm_results[idx]
                            results_map[temp_id] = {
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

        await db_session.commit()

        # Link Tag entities to chunks, deduplicating to prevent unique constraint violations on item_tags
        for c in tagged_chunks:
            resolved = []
            seen_names = set()
            for t_name in c["tags"]:
                name_lower = t_name.lower()
                if name_lower not in seen_names:
                    seen_names.add(name_lower)
                    tag_obj = db_tags.get(name_lower)
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
