import os
import re
import fitz
from markitdown import MarkItDown

def clean_markdown(text: str) -> str:
    """Cleans up the extracted text:
    - Removes repeated control characters.
    - Resolves typical encoding issues.
    - Limits repeated blank lines to a maximum of 2 consecutive blank lines.
    """
    if not text:
        return ""

    # Strip control characters (ASCII 0-31) except tab (9), newline (10), and carriage return (13)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', text)

    # Standardize common unicode artifacts
    text = text.replace('\xa0', ' ')  # Non-breaking space
    text = text.replace('\u201c', '"').replace('\u201d', '"')  # Smart double quotes
    text = text.replace('\u2018', "'").replace('\u2019', "'")  # Smart single quotes
    text = text.replace('\u2013', '-').replace('\u2014', '--') # Hyphens/dashes

    # Remove excessive blank lines: limit to max 2 consecutive blank lines (which means max 3 consecutive newlines)
    text = re.sub(r'\n{4,}', '\n\n\n', text)

    return text.strip()


def extract_to_markdown(file_path: str) -> tuple[str, int]:
    """Converts input document to Markdown format.
    Tries MarkItDown first. If result has < 200 characters or fails,
    falls back to PyMuPDF (for PDFs) or standard text reading.
    Returns: (cleaned_markdown_text, page_count)
    """
    ext = os.path.splitext(file_path)[1].lower()
    page_count = 1

    # First, parse page count for PDFs
    if ext == ".pdf":
        try:
            doc = fitz.open(file_path)
            page_count = len(doc)
            doc.close()
        except Exception as e:
            print(f"[Extractor] Failed to count PDF pages using PyMuPDF: {e}")

    extracted_text = ""
    markitdown_success = False

    try:
        md = MarkItDown()
        result = md.convert(file_path)
        if result and result.text_content:
            extracted_text = result.text_content
            # Validate output length is sufficient (i.e. not empty or scanned/empty image)
            if len(extracted_text.strip()) >= 200:
                markitdown_success = True
            else:
                print(f"[Extractor] MarkItDown returned only {len(extracted_text.strip())} chars. Triggering fallback.")
    except Exception as e:
        print(f"[Extractor] MarkItDown failed conversion: {e}")

    # Fallback to PyMuPDF or plain text reader
    if not markitdown_success:
        print(f"[Extractor] Executing fallback extraction for {file_path}...")
        if ext == ".pdf":
            try:
                doc = fitz.open(file_path)
                pages_text = []
                for page in doc:
                    pages_text.append(page.get_text())
                extracted_text = "\n\n".join(pages_text)
                doc.close()
            except Exception as e:
                print(f"[Extractor] PyMuPDF fallback failed: {e}")
        elif ext in [".txt", ".md"]:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    extracted_text = f.read()
            except Exception as e:
                print(f"[Extractor] Plain text file read fallback failed: {e}")
        else:
            print(f"[Extractor] No custom fallback strategy for extension '{ext}'. Keeping MarkItDown output.")

    # Apply markdown cleaning
    cleaned_text = clean_markdown(extracted_text)
    return cleaned_text, page_count


async def extract_via_ai_vision(file_path: str) -> str:
    """Extracts text from a scanned PDF or an image file using a vision model."""
    import base64
    import fitz
    from backend.services.ai_client import get_ai_client, AIClient
    
    ext = os.path.splitext(file_path)[1].lower()
    
    # Get active extraction client to find the configured provider and keys
    try:
        client = get_ai_client("extraction")
    except Exception as e:
        print(f"[Extractor] No AI client configured for vision extraction: {e}")
        return ""

    # Choose a vision model for the provider
    vision_model = None
    if client.provider == "groq":
        vision_model = "llama-3.2-11b-vision-instruct"
    elif client.provider == "nvidia":
        vision_model = "meta/llama-3.2-11b-vision-instruct"
    elif client.provider == "openrouter":
        vision_model = "google/gemini-2.0-flash"
    elif client.provider == "gemini":
        vision_model = "gemini-1.5-flash"
    elif client.provider == "openai":
        vision_model = "gpt-4o-mini"

    if not vision_model:
        print(f"[Extractor] Provider '{client.provider}' does not support vision OCR fallback.")
        return ""

    print(f"[Extractor] Starting AI vision OCR for {file_path} using {client.provider}:{vision_model}...")

    # Create a separate client instance for the vision model
    vision_client = AIClient(provider=client.provider, model=vision_model, api_key=client.api_key)

    system_prompt = (
        "You are an expert OCR transcription assistant. Your task is to transcribe "
        "the provided image containing notes/handwriting/text into clean, well-formatted Markdown. "
        "Maintain structural layout, headings, lists, tables, and code blocks. "
        "Do not add extra explanations, greetings, or conversational filler. Only return the markdown content."
    )
    user_prompt = "Transcribe this image into markdown:"

    if ext in [".png", ".jpg", ".jpeg"]:
        try:
            with open(file_path, "rb") as f:
                img_bytes = f.read()
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
            return await vision_client.complete_with_image(system_prompt, user_prompt, img_b64)
        except Exception as e:
            print(f"[Extractor] Image vision OCR failed: {e}")
            return ""
            
    elif ext == ".pdf":
        doc = fitz.open(file_path)
        pages_text = []
        for page_num in range(len(doc)):
            print(f"[Extractor] Processing page {page_num + 1}/{len(doc)}...")
            page = doc[page_num]
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
            
            try:
                page_markdown = await vision_client.complete_with_image(system_prompt, user_prompt, img_b64)
                pages_text.append(page_markdown)
            except Exception as e:
                print(f"[Extractor] Vision OCR failed on page {page_num + 1}: {e}")
                pages_text.append(f"\n[Page {page_num + 1} extraction failed]\n")
        doc.close()
        return "\n\n---\n\n".join(pages_text)
        
    return ""
