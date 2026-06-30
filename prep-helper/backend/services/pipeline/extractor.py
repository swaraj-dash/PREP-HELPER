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


async def extract_to_markdown_async(file_path: str, ai_client) -> tuple[str, int]:
    """Converts input document to Markdown format asynchronously.
    For PDFs, it uses a page-by-page hybrid strategy:
      - If a page has >= 150 characters of digital text, it uses the digital text.
      - Otherwise, it falls back to running AI Vision OCR on that page.
    For non-PDF files, it tries MarkItDown first, and falls back to plain text read or single-image vision OCR.
    Returns: (cleaned_markdown_text, page_count)
    """
    import base64
    from backend.services.ai_client import AIClient
    ext = os.path.splitext(file_path)[1].lower()
    page_count = 1

    if ext == ".pdf":
        try:
            doc = fitz.open(file_path)
            page_count = len(doc)
        except Exception as e:
            print(f"[Extractor] Failed to open PDF using PyMuPDF: {e}")
            return "", 0

        # Choose a vision model for the provider
        vision_model = None
        if ai_client.provider == "groq":
            vision_model = "llama-3.2-11b-vision-instruct"
        elif ai_client.provider == "nvidia":
            vision_model = "meta/llama-3.2-11b-vision-instruct"
        elif ai_client.provider == "openrouter":
            vision_model = "google/gemini-2.0-flash"
        elif ai_client.provider == "gemini":
            vision_model = "gemini-1.5-flash"
        elif ai_client.provider == "openai":
            vision_model = "gpt-4o-mini"

        vision_client = None
        if vision_model:
            vision_client = AIClient(provider=ai_client.provider, model=vision_model, api_key=ai_client.api_key)
        else:
            print(f"[Extractor] Provider '{ai_client.provider}' does not support vision OCR fallback. Using digital text fallback.")

        system_prompt = (
            "You are an expert OCR transcription assistant. Your task is to transcribe "
            "the provided image containing notes/handwriting/text into clean, well-formatted Markdown. "
            "Maintain structural layout, headings, lists, tables, and code blocks. "
            "Do not add extra explanations, greetings, or conversational filler. Only return the markdown content."
        )
        user_prompt = "Transcribe this page image into markdown:"

        pages_text = []
        for page_num in range(page_count):
            print(f"[Extractor] Processing page {page_num + 1}/{page_count}...")
            page = doc[page_num]
            digital_text = page.get_text()
            
            # Check if digital text is empty or very short (< 150 characters)
            if len(digital_text.strip()) < 150:
                if vision_client:
                    print(f"[Extractor] Scanned/low-text page detected (page {page_num + 1}/{page_count}). Triggering AI Vision OCR...")
                    try:
                        pix = page.get_pixmap(dpi=150)
                        img_bytes = pix.tobytes("png")
                        img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                        page_markdown = await vision_client.complete_with_image(system_prompt, user_prompt, img_b64)
                        pages_text.append(page_markdown)
                    except Exception as e:
                        print(f"[Extractor] Vision OCR failed on page {page_num + 1}: {e}")
                        pages_text.append(digital_text)
                else:
                    pages_text.append(digital_text)
            else:
                pages_text.append(digital_text)
        
        doc.close()
        extracted_text = "\n\n---\n\n".join(pages_text)
        cleaned_text = clean_markdown(extracted_text)
        return cleaned_text, page_count

    # Non-PDF files:
    extracted_text = ""
    markitdown_success = False

    try:
        md = MarkItDown()
        result = md.convert(file_path)
        if result and result.text_content:
            extracted_text = result.text_content
            if len(extracted_text.strip()) >= 200:
                markitdown_success = True
            else:
                print(f"[Extractor] MarkItDown returned only {len(extracted_text.strip())} chars. Triggering fallback.")
    except Exception as e:
        print(f"[Extractor] MarkItDown failed conversion: {e}")

    # Fallback/alternative strategies
    if not markitdown_success:
        print(f"[Extractor] Executing fallback extraction for {file_path}...")
        if ext in [".txt", ".md"]:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    extracted_text = f.read()
            except Exception as e:
                print(f"[Extractor] Plain text file read fallback failed: {e}")
        elif ext in [".png", ".jpg", ".jpeg"]:
            # Image files
            vision_model = None
            if ai_client.provider == "groq":
                vision_model = "llama-3.2-11b-vision-instruct"
            elif ai_client.provider == "nvidia":
                vision_model = "meta/llama-3.2-11b-vision-instruct"
            elif ai_client.provider == "openrouter":
                vision_model = "google/gemini-2.0-flash"
            elif ai_client.provider == "gemini":
                vision_model = "gemini-1.5-flash"
            elif ai_client.provider == "openai":
                vision_model = "gpt-4o-mini"

            if vision_model:
                from backend.services.ai_client import AIClient
                vision_client = AIClient(provider=ai_client.provider, model=vision_model, api_key=ai_client.api_key)
                
                system_prompt = (
                    "You are an expert OCR transcription assistant. Your task is to transcribe "
                    "the provided image containing notes/handwriting/text into clean, well-formatted Markdown. "
                    "Do not add extra explanations, greetings, or conversational filler."
                )
                user_prompt = "Transcribe this image into markdown:"
                try:
                    with open(file_path, "rb") as f:
                        img_bytes = f.read()
                    img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                    extracted_text = await vision_client.complete_with_image(system_prompt, user_prompt, img_b64)
                except Exception as e:
                    print(f"[Extractor] Image vision OCR failed: {e}")
            else:
                print(f"[Extractor] No vision model supported for provider {ai_client.provider} to parse image.")
        else:
            print(f"[Extractor] No custom fallback strategy for extension '{ext}'. Keeping MarkItDown output.")

    cleaned_text = clean_markdown(extracted_text)
    return cleaned_text, page_count
