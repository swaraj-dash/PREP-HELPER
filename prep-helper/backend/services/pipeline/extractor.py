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
