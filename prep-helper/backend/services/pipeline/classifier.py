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

async def classify_document(text: str, ai_client: AIClient) -> dict:
    """Determines the structural category of the document based on its first 2000 characters.
    Returns:
        dict: {"type": "QA_HEAVY"|"NOTES_HEAVY"|"MIXED", "confidence": float, "qa_ratio": float}
    """
    excerpt = text[:2000]
    
    system_prompt = "You are a document classifier. Respond ONLY with valid JSON, no markdown or extra text."
    user_prompt = (
        "Classify this document excerpt. Return a JSON object with keys: "
        '"type" (string, must be "QA_HEAVY", "NOTES_HEAVY", or "MIXED"), '
        '"confidence" (float between 0.0 and 1.0), and '
        '"qa_ratio" (float between 0.0 and 1.0 representing proportion of Q&A formatting vs narrative/explanations).\n\n'
        f"Document excerpt (first 2000 chars):\n{excerpt}"
    )

    default_response = {
        "type": "MIXED",
        "confidence": 0.5,
        "qa_ratio": 0.5
    }

    if not excerpt.strip():
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
            "qa_ratio": float(data.get("qa_ratio", 0.5))
        }
    except Exception as e:
        print(f"[Classifier] Failed to classify document: {e}. Defaulting to MIXED.")
        return default_response
