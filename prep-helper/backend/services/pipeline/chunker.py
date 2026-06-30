import re
import json
import asyncio
from backend.services.ai_client import AIClient
from backend.services.pipeline.classifier import clean_json_response

def chunk_qa_regex(text: str) -> list[dict]:
    """Attempts to extract Q&A pairs using common regex patterns in order of priority.
    Returns:
        list[dict]: List of {"q": question, "a": answer, "page_ref": None}
    """
    # Pattern A: Q: ... A: ...
    pattern_a = re.compile(
        r'(?:^|\n)\s*Q\s*:\s*(.*?)\n\s*A\s*:\s*(.*?)(?=\n\s*(?:Q\s*:|\d+\.|#{1,3}\s|\*\*Q|\*\*Question)|$)',
        re.DOTALL | re.IGNORECASE
    )
    # Pattern B: **Q:** ... **A:** ... or **Question N** ... **Answer:**
    pattern_b = re.compile(
        r'(?:^|\n)\s*\*\*(?:Q|Question)\s*(?:\d+)?[\.\):]?\*\*\s*:?\s*(.*?)\n\s*\*\*(?:A|Answer|Ans)\s*[\.\):]?\*\*\s*:?\s*(.*?)(?=\n\s*(?:\*\*(?:Q|Question)|Q\s*:|\d+\.\s|#{1,3}\s)|$)',
        re.DOTALL | re.IGNORECASE
    )
    # Pattern C: Numbered questions with Answer: line — 1. Question? \n Answer: ...
    pattern_c = re.compile(
        r'(?:^|\n)\s*\d+[\.\)]\s*(.*?)\n\s*(?:A|Answer|Ans)\s*:\s*(.*?)(?=\n\s*(?:\d+[\.\)]\s|Q\s*:|\*\*Q|#{1,3}\s)|$)',
        re.DOTALL | re.IGNORECASE
    )
    # Pattern D: **1.** or **1)** Bold-numbered questions followed by paragraph answers
    pattern_d = re.compile(
        r'(?:^|\n)\s*\*\*\d+[\.\)]\*\*\s*(.*?)\n(.*?)(?=\n\s*\*\*\d+[\.\)]|$)',
        re.DOTALL
    )
    # Pattern E: Numbered questions (1. What is...?) followed by paragraph answer until next number
    pattern_e = re.compile(
        r'(?:^|\n)\s*(\d+)[\.\)]\s+((?:What|How|Why|When|Where|Which|Who|Explain|Describe|Define|List|Name|Discuss|Compare|Differentiate|State|Is\s|Are\s|Can\s|Do\s|Does\s|Will\s|Would\s|Should\s|Give\s|Mention\s|Write\s|Enumerate\s|Illustrate\s|Classify\s|Distinguish\s|Outline\s|Summarize\s|Evaluate\s).*?[?\n])\s*(.*?)(?=\n\s*\d+[\.\)]\s+(?:What|How|Why|When|Where|Which|Who|Explain|Describe|Define|List|Name|Discuss|Compare|Differentiate|State|Is\s|Are\s|Can\s|Do\s|Does\s|Will\s|Would\s|Should\s|Give\s|Mention\s|Write\s|Enumerate\s|Illustrate\s|Classify\s|Distinguish\s|Outline\s|Summarize\s|Evaluate\s)|$)',
        re.DOTALL | re.IGNORECASE
    )
    # Pattern F: Simple numbered list (1. Question\n   Answer paragraph) — generic catch-all
    pattern_f = re.compile(
        r'(?:^|\n)\s*(\d+)[\.\)]\s+(.+?[?])\s*\n(.*?)(?=\n\s*\d+[\.\)]\s|$)',
        re.DOTALL
    )

    all_patterns = [
        (pattern_a, "Pattern A (Q:/A:)", 2),
        (pattern_b, "Pattern B (**Q:**/**A:**)", 2),
        (pattern_c, "Pattern C (Numbered + Answer:)", 2),
        (pattern_d, "Pattern D (**N.** Question)", 2),
        (pattern_e, "Pattern E (Numbered interrogative)", 3),
        (pattern_f, "Pattern F (Numbered question?)", 3),
    ]

    for pattern, name, group_count in all_patterns:
        matches = pattern.findall(text)
        if len(matches) >= 3:
            results = []
            for match in matches:
                if group_count == 2:
                    q_clean = match[0].strip()
                    a_clean = match[1].strip()
                elif group_count == 3:
                    # For patterns that capture number + question + answer
                    q_clean = match[1].strip() if len(match) > 2 else match[0].strip()
                    a_clean = match[2].strip() if len(match) > 2 else match[1].strip()
                else:
                    continue

                if q_clean and a_clean and len(q_clean) > 10 and len(a_clean) > 15:
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
    Splits text into chunks of 4000 chars with 500 chars overlap to ensure context boundary coverage.
    """
    chunk_size = 4000
    overlap = 500
    all_pairs = []
    seen_questions = set()

    system_prompt = (
        "You are an expert at extracting question-answer pairs from educational content.\n"
        "Extract ALL technical question-answer pairs from the provided text.\n"
        "If the text contains numbered questions with answers, extract each as a separate pair.\n"
        "If the text contains interview questions, extract each question with its full answer.\n\n"
        "Return ONLY a JSON array of objects, where each object has keys:\n"
        '- "q" (the complete question text, clean and well-formed)\n'
        '- "a" (the complete detailed answer text, preserving all technical details, code, and formatting)\n\n'
        "IMPORTANT:\n"
        "- Preserve code snippets, bullet points, and formatting in answers\n"
        "- Each question should be a clear, standalone question\n"
        "- Do not skip any Q&A pairs found in the text\n"
        "- Do not return markdown formatting around the JSON, no code block tickmarks\n"
        "- Do not add extra explanations or conversational filler"
    )

    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = min(start + chunk_size, text_len)
        segment = text[start:end]
        
        user_prompt = f"Extract all Q&A pairs from this text:\n\n{segment}"
        try:
            if start > 0:
                await asyncio.sleep(2.0)
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
            
            # Robust check in case LLM wraps array in a dictionary (e.g. {"qa_pairs": [...]})
            if isinstance(pairs, dict):
                for key in ["qa_pairs", "pairs", "results", "chunks", "data", "items", "questions"]:
                    if key in pairs and isinstance(pairs[key], list):
                        pairs = pairs[key]
                        break
                else:
                    if "q" in pairs or "a" in pairs:
                        pairs = [pairs]

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


def _derive_heading_from_content(lines: list[str]) -> str:
    """Attempts to derive a meaningful heading from the first non-empty content lines.
    Tries bold text patterns, first short sentence, or falls back to 'General'.
    """
    for line in lines[:5]:
        stripped = line.strip()
        if not stripped:
            continue
        
        # Detect bold text as pseudo-heading: **Some Title** or __Some Title__
        bold_match = re.match(r'^\*\*(.+?)\*\*\s*$', stripped)
        if bold_match:
            return bold_match.group(1).strip()
        
        bold_match2 = re.match(r'^__(.+?)__\s*$', stripped)
        if bold_match2:
            return bold_match2.group(1).strip()
        
        # Use a short first line as heading (likely a title)
        if len(stripped) < 80 and not stripped.startswith('-') and not stripped.startswith('*'):
            return stripped.rstrip('.,:;')
    
    return "General"


def chunk_notes(text: str) -> list[dict]:
    """Splits markdown notes on heading boundaries (#, ##, ###), bold-text section headers, and segments large sections."""
    lines = text.split("\n")
    chunks = []
    current_heading = None  # Will be derived from content, not hardcoded
    current_lines = []
    position = 0

    def flush_section():
        nonlocal current_heading, current_lines, position
        if current_lines:
            content_text = "\n".join(current_lines).strip()
            if content_text:
                # If no heading was set, derive from content
                heading_text = current_heading or _derive_heading_from_content(current_lines)
                sub_chunks = split_large_note_content(heading_text, content_text)
                for sc in sub_chunks:
                    chunks.append({
                        "heading": sc["heading"],
                        "content": sc["content"],
                        "position": position
                    })
                    position += 1
            current_lines = []

    for line in lines:
        # Match markdown headings up to ###
        md_heading = re.match(r'^(#{1,3})\s+(.*)$', line)
        if md_heading:
            flush_section()
            current_heading = md_heading.group(2).strip()
            continue
        
        # Match UNIT/CHAPTER/PART headers: UNIT 1 -- Introduction to Java or CHAPTER 2: Variables
        unit_heading = re.match(r'^\s*(?:UNIT|CHAPTER|PART|Chapter|Unit|Part)\s+\w+(?:\s*[-–—:]+\s*|\s+)([^?]{3,80})$', line)
        if unit_heading:
            flush_section()
            current_heading = unit_heading.group(1).strip()
            continue
        
        # Match bold-text section headers: **Section Title** (standalone on its own line)
        bold_heading = re.match(r'^\s*\*\*([^*]{3,80})\*\*\s*$', line)
        if bold_heading and not current_lines:
            # Only treat as heading if we're at the start of a new section
            flush_section()
            current_heading = bold_heading.group(1).strip()
            continue
        
        # Match numbered section headers: 1. Topic Name or 1.1 History of Java (without question mark)
        numbered_heading = re.match(r'^\s*\d+(?:\.\d+)*[\.\)]\s+([A-Z][^?]{4,80})$', line)
        if numbered_heading and not any(kw in line.lower() for kw in ['what ', 'how ', 'why ', 'when ', 'where ', 'which ', 'explain ', 'describe ']):
            flush_section()
            current_heading = numbered_heading.group(1).strip()
            continue

        current_lines.append(line)

    # Flush last section
    flush_section()

    return chunks


async def chunk_document(text: str, doc_type: str, ai_client: AIClient) -> tuple[list[dict], list[dict]]:
    """Delegates chunking and structuring to specialized agents: QAAgent and NotesDesignerAgent."""
    from backend.services.pipeline.agents import QAAgent, NotesDesignerAgent

    qa_chunks = []
    note_chunks = []
    doc_type_upper = doc_type.upper()

    if doc_type_upper == "QA_HEAVY":
        qa_agent = QAAgent()
        qa_chunks = await qa_agent.extract_qa(text, ai_client)
        if not qa_chunks:
            print("[Chunker] QA_HEAVY document but no Q&A pairs found. Falling back to NotesDesignerAgent...")
            notes_agent = NotesDesignerAgent()
            note_chunks = await notes_agent.design_notes(text, ai_client)
    elif doc_type_upper == "NOTES_HEAVY":
        notes_agent = NotesDesignerAgent()
        note_chunks = await notes_agent.design_notes(text, ai_client)
    else:  # MIXED
        qa_agent = QAAgent()
        notes_agent = NotesDesignerAgent()
        qa_chunks = await qa_agent.extract_qa(text, ai_client)
        note_chunks = await notes_agent.design_notes(text, ai_client)

    return qa_chunks, note_chunks
