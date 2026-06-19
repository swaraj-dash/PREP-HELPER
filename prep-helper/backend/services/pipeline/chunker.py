import re
import json
from backend.services.ai_client import AIClient
from backend.services.pipeline.classifier import clean_json_response

def chunk_qa_regex(text: str) -> list[dict]:
    """Attempts to extract Q&A pairs using common regex patterns in order of priority.
    Returns:
        list[dict]: List of {"q": question, "a": answer, "page_ref": None}
    """
    # Pattern A: Q: ... A: ...
    pattern_a = re.compile(
        r'(?:^|\n)\s*Q\s*:\s*(.*?)\n\s*A\s*:\s*(.*?)(?=\n\s*(?:Q\s*:|\d+\.|\*\*Q|\*\*Question|#)|$)',
        re.DOTALL | re.IGNORECASE
    )
    # Pattern B: **Q:** ... **A:** ...
    pattern_b = re.compile(
        r'(?:^|\n)\s*\*\*(?:Q|Question)(?:\s+\d+)?\*\*\s*:\s*(.*?)\n\s*\*\*(?:A|Answer)\*\*\s*:\s*(.*?)(?=\n\s*(?:\*\*(?:Q|Question)|\d+\.|Q\s*:|#)|$)',
        re.DOTALL | re.IGNORECASE
    )
    # Pattern C: Numbered 1. Question? \n Answer: ...
    pattern_c = re.compile(
        r'(?:^|\n)\s*\d+\.\s*(.*?)\n\s*(?:A|Answer|Ans)\s*:\s*(.*?)(?=\n\s*(?:\d+\.|Q\s*:|\*\*Q|#)|$)',
        re.DOTALL | re.IGNORECASE
    )

    for pattern, name in [(pattern_a, "Pattern A"), (pattern_b, "Pattern B"), (pattern_c, "Pattern C")]:
        matches = pattern.findall(text)
        if len(matches) >= 3:
            results = []
            for q, a in matches:
                q_clean = q.strip()
                a_clean = a.strip()
                if q_clean and a_clean:
                    results.append({
                        "q": q_clean,
                        "a": a_clean,
                        "page_ref": None
                    })
            if len(results) >= 3:
                print(f"[Chunker] Successfully extracted {len(results)} pairs using {name}.")
                return results

    return []


async def chunk_qa_llm(text: str, ai_client: AIClient) -> list[dict]:
    """Fallback LLM-based Q&A chunker when regex matching fails or yields < 3 pairs.
    Splits text into chunks of 3000 chars with 500 chars overlap to ensure context boundary coverage.
    """
    chunk_size = 3000
    overlap = 500
    all_pairs = []
    seen_questions = set()

    system_prompt = (
        "Extract all technical question-answer pairs from the provided text.\n"
        "Return ONLY a JSON array of objects, where each object has keys:\n"
        '- "q" (the complete question text)\n'
        '- "a" (the complete detailed answer text)\n'
        "Do not return markdown formatting, no code block tickmarks, no introductions, no explanations."
    )

    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        segment = text[start:end]
        
        user_prompt = f"Extract Q&A pairs from the following text segment:\n\n{segment}"
        try:
            response_text = await ai_client.complete(
                system=system_prompt,
                user=user_prompt,
                json_mode=True
            )
            cleaned = clean_json_response(response_text)
            
            # Simple check in case it's not a JSON list
            if cleaned.startswith("{") and not cleaned.startswith("["):
                # Wrap inside a list if it's a single dictionary
                cleaned = f"[{cleaned}]"

            pairs = json.loads(cleaned)
            if isinstance(pairs, list):
                for p in pairs:
                    q_text = p.get("q", "").strip()
                    a_text = p.get("a", "").strip()
                    if q_text and a_text:
                        # Deduplicate by normalising spacing and comparing prefixes
                        normalized = re.sub(r'\s+', ' ', q_text.lower())[:120]
                        if normalized not in seen_questions:
                            seen_questions.add(normalized)
                            all_pairs.append({
                                "q": q_text,
                                "a": a_text,
                                "page_ref": None
                            })
        except Exception as e:
            print(f"[Chunker] LLM fallback chunker error at range [{start}:{end}]: {e}")
            
        start += (chunk_size - overlap)
        if end == text_len:
            break

    print(f"[Chunker] LLM fallback extraction found {len(all_pairs)} Q&A pairs.")
    return all_pairs


def split_large_note_content(heading: str, content: str, max_chars: int = 2000) -> list[dict]:
    """Helper to split long section content by paragraph boundary to satisfy token limits."""
    if len(content) <= max_chars:
        return [{"heading": heading, "content": content}]

    paragraphs = content.split("\n\n")
    chunks = []
    current_block = []
    current_len = 0

    for p in paragraphs:
        p_clean = p.strip()
        if not p_clean:
            continue
        if current_len + len(p_clean) > max_chars and current_block:
            chunks.append({
                "heading": heading,
                "content": "\n\n".join(current_block)
            })
            current_block = [p_clean]
            current_len = len(p_clean)
        else:
            current_block.append(p_clean)
            current_len += len(p_clean) + 2

    if current_block:
        chunks.append({
            "heading": heading,
            "content": "\n\n".join(current_block)
        })

    return chunks


def chunk_notes(text: str) -> list[dict]:
    """Splits markdown notes on heading boundaries (#, ##, ###) and segments large sections."""
    lines = text.split("\n")
    chunks = []
    current_heading = "Introduction"
    current_lines = []
    position = 0

    for line in lines:
        # Match headings up to ###
        match = re.match(r'^(#{1,3})\s+(.*)$', line)
        if match:
            if current_lines:
                heading_text = current_heading
                content_text = "\n".join(current_lines).strip()
                if content_text:
                    sub_chunks = split_large_note_content(heading_text, content_text)
                    for sc in sub_chunks:
                        chunks.append({
                            "heading": sc["heading"],
                            "content": sc["content"],
                            "position": position
                        })
                        position += 1
                current_lines = []
            current_heading = match.group(2).strip()
        else:
            current_lines.append(line)

    if current_lines:
        content_text = "\n".join(current_lines).strip()
        if content_text:
            sub_chunks = split_large_note_content(current_heading, content_text)
            for sc in sub_chunks:
                chunks.append({
                    "heading": sc["heading"],
                    "content": sc["content"],
                    "position": position
                })
                position += 1

    return chunks


async def chunk_document(text: str, doc_type: str, ai_client: AIClient) -> tuple[list[dict], list[dict]]:
    """Splits document text into Q&A pairs and/or Note chunks based on the doc_type classification.
    Returns:
        tuple[list, list]: (qa_chunks, note_chunks)
    """
    qa_chunks = []
    note_chunks = []

    doc_type_upper = doc_type.upper()

    if doc_type_upper in ["QA_HEAVY", "MIXED"]:
        # Try regex first
        qa_chunks = chunk_qa_regex(text)
        if not qa_chunks:
            # Fallback to LLM extraction
            qa_chunks = await chunk_qa_llm(text, ai_client)

    if doc_type_upper in ["NOTES_HEAVY", "MIXED"]:
        note_chunks = chunk_notes(text)

    return qa_chunks, note_chunks
