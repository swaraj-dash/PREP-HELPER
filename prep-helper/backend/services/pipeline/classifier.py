import json
import re
from backend.services.ai_client import AIClient

def clean_json_response(raw_text: str) -> str:
    """Strips markdown block wraps (` ```json ... ``` `) if returned by the LLM."""
    raw_text = raw_text.strip()
    match = re.search(r'```(?:json)?\s*(.*?)\s*```', raw_text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return raw_text


def detect_qa_patterns(text: str) -> float:
    """Pre-analyzes text using regex to estimate Q&A ratio without LLM calls.
    Returns a float 0.0 - 1.0 representing estimated Q&A density.
    """
    lines = text.split('\n')
    total_lines = max(len(lines), 1)
    qa_indicator_count = 0

    # Pattern indicators for Q&A format
    qa_patterns = [
        re.compile(r'^\s*Q\s*[:\.]\s', re.IGNORECASE),
        re.compile(r'^\s*A\s*[:\.]\s', re.IGNORECASE),
        re.compile(r'^\s*\*\*(?:Q|Question)\s*\d*\*\*', re.IGNORECASE),
        re.compile(r'^\s*\*\*(?:A|Answer)\*\*', re.IGNORECASE),
        re.compile(r'^\s*(?:Question|Ans|Answer)\s*[:\.]\s', re.IGNORECASE),
        re.compile(r'^\s*\d+\.\s+(?:What|How|Why|When|Where|Which|Who|Explain|Describe|Define|List|Name|Discuss|Compare|Differentiate|State|Is\s|Are\s|Can\s|Do\s|Does\s|Will\s|Would\s|Should\s)', re.IGNORECASE),
        re.compile(r'^\s*[-•]\s*(?:What|How|Why|When|Where|Which|Who|Explain|Describe|Define|List|Name)', re.IGNORECASE),
        re.compile(r'^\s*\*\*\d+[\.\)]\*\*\s', re.IGNORECASE),
        re.compile(r'^\s*\d+[\.\)]\s+\*\*', re.IGNORECASE),
    ]

    for line in lines:
        for pattern in qa_patterns:
            if pattern.search(line):
                qa_indicator_count += 1
                break

    ratio = qa_indicator_count / total_lines
    return min(1.0, ratio * 3.0)  # Amplify since Q&A lines are sparse relative to answer text


async def classify_document(text: str, ai_client: AIClient) -> dict:
    """Determines the structural category of the document based on regex pre-analysis and LLM classification.
    Returns:
        dict: {"type": "QA_HEAVY"|"NOTES_HEAVY"|"MIXED", "confidence": float, "qa_ratio": float}
    """
    # Regex pre-analysis on full text for pattern detection
    regex_qa_ratio = detect_qa_patterns(text)

    # If regex is very confident, skip the LLM call
    if regex_qa_ratio >= 0.6:
        print(f"[Classifier] Regex pre-analysis detected strong Q&A patterns (ratio={regex_qa_ratio:.2f}). Classifying as QA_HEAVY without LLM.")
        return {
            "type": "QA_HEAVY",
            "confidence": 0.9,
            "qa_ratio": regex_qa_ratio
        }
    if regex_qa_ratio <= 0.05:
        print(f"[Classifier] Regex pre-analysis detected minimal Q&A patterns (ratio={regex_qa_ratio:.2f}). Classifying as NOTES_HEAVY without LLM.")
        return {
            "type": "NOTES_HEAVY",
            "confidence": 0.85,
            "qa_ratio": regex_qa_ratio
        }

    # Use a larger excerpt for LLM classification — sample from beginning AND middle
    excerpt_start = text[:3000]
    mid_point = len(text) // 2
    excerpt_mid = text[mid_point:mid_point + 3000]
    excerpt = f"--- BEGINNING OF DOCUMENT ---\n{excerpt_start}\n\n--- MIDDLE OF DOCUMENT ---\n{excerpt_mid}"

    system_prompt = "You are a document structure classifier. Respond ONLY with valid JSON, no markdown or extra text."
    user_prompt = (
        "Classify this document excerpt into one of three categories based on its structure:\n\n"
        "- **QA_HEAVY**: Contains question-answer pairs, interview questions, quiz content, FAQ lists, or numbered questions with answers. "
        "Look for patterns like 'Q:', 'Question:', numbered questions (1. What is...), bold questions followed by answers, etc.\n"
        "- **NOTES_HEAVY**: Contains explanatory notes, tutorials, guides, textbook content, or reference material organized by topics/headings.\n"
        "- **MIXED**: Contains a significant mix of both Q&A and explanatory note content.\n\n"
        "Return a JSON object with keys:\n"
        '- "type" (string: "QA_HEAVY", "NOTES_HEAVY", or "MIXED")\n'
        '- "confidence" (float 0.0-1.0)\n'
        f'- "qa_ratio" (float 0.0-1.0, proportion of Q&A content vs notes)\n\n'
        f"Regex pre-analysis detected a Q&A indicator ratio of {regex_qa_ratio:.2f}. Use this as a hint.\n\n"
        f"Document excerpt:\n{excerpt}"
    )

    default_response = {
        "type": "MIXED",
        "confidence": 0.5,
        "qa_ratio": regex_qa_ratio
    }

    if not text.strip():
        return default_response

    try:
        response_text = await ai_client.complete(
            system=system_prompt,
            user=user_prompt,
            json_mode=True
        )
        cleaned_response = clean_json_response(response_text)
        data = json.loads(cleaned_response)

        doc_type = data.get("type", "MIXED").upper()
        if doc_type not in ["QA_HEAVY", "NOTES_HEAVY", "MIXED"]:
            doc_type = "MIXED"

        return {
            "type": doc_type,
            "confidence": float(data.get("confidence", 0.5)),
            "qa_ratio": float(data.get("qa_ratio", regex_qa_ratio))
        }
    except Exception as e:
        print(f"[Classifier] Failed to classify document: {e}. Using regex-based fallback.")
        # Fallback based on regex analysis
        if regex_qa_ratio >= 0.3:
            return {"type": "QA_HEAVY", "confidence": 0.6, "qa_ratio": regex_qa_ratio}
        elif regex_qa_ratio >= 0.15:
            return {"type": "MIXED", "confidence": 0.5, "qa_ratio": regex_qa_ratio}
        else:
            return default_response
