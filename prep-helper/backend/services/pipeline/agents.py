import re
import json
import asyncio
from backend.services.ai_client import AIClient
from backend.services.pipeline.classifier import clean_json_response

class QAAgent:
    """Agent responsible for parsing and extracting Q&A pairs from text content."""
    
    def __init__(self):
        pass

    async def extract_qa(self, text: str, ai_client: AIClient) -> list[dict]:
        """Extracts Q&A pairs from raw text. Uses regex first, then falls back to LLM extraction."""
        from backend.services.pipeline.chunker import chunk_qa_regex, chunk_qa_llm
        
        # 1. Try regex extraction first
        qa_chunks = chunk_qa_regex(text)
        if qa_chunks:
            print(f"[QAAgent] Successfully extracted {len(qa_chunks)} Q&As using regex.")
            return qa_chunks
            
        # 2. Fallback to LLM extraction
        print("[QAAgent] Regex extraction yielded nothing. Running LLM extraction...")
        qa_chunks = await chunk_qa_llm(text, ai_client)
        return qa_chunks


class NotesDesignerAgent:
    """Agent responsible for organizing, formatting, and beautifying study notes,
    and classifying note chunks with semantic types.
    """
    
    def __init__(self):
        pass

    async def _design_single_chunk(self, chunk: dict, ai_client: AIClient, system_prompt: str) -> dict:
        heading = chunk["heading"]
        content = chunk["content"]
        position = chunk["position"]
        
        if len(content.strip()) < 80:
            return {
                "heading": heading,
                "content": content,
                "content_type": "concept",
                "position": position
            }
            
        user_prompt = f"Heading: {heading}\nContent:\n{content}"
        try:
            response = await ai_client.complete(
                system=system_prompt,
                user=user_prompt,
                json_mode=True
            )
            cleaned = clean_json_response(response)
            data = json.loads(cleaned)
            
            return {
                "heading": heading,
                "content": data.get("content", content).strip(),
                "content_type": data.get("content_type", "concept").lower(),
                "position": position
            }
        except Exception as e:
            print(f"[NotesDesignerAgent] Designing failed for chunk '{heading}': {e}")
            return {
                "heading": heading,
                "content": content,
                "content_type": "concept",
                "position": position
            }

    async def design_notes(self, text: str, ai_client: AIClient) -> list[dict]:
        """Organizes raw text into sections, formats them beautifully using an LLM in batches,
        and determines their content types.
        """
        from backend.services.pipeline.chunker import chunk_notes
        
        # 1. Segment text into heading-based raw chunks
        raw_chunks = chunk_notes(text)
        if not raw_chunks:
            return []
            
        print(f"[NotesDesignerAgent] Formatting and designing {len(raw_chunks)} notes chunks...")
        designed_chunks = []
        
        # Design prompt to beautify notes content and categorize it
        system_prompt = (
            "You are the Notes Designer Agent. Your goal is to design a visually beautiful, "
            "highly structured, and readable technical study note from raw text segment.\n"
            "You must:\n"
            "- Reformat the content with beautiful Markdown (headings, bold keywords for key concepts, lists, code blocks, tables)\n"
            "- Classify the note type into one of: 'definition', 'example', 'code', 'concept', 'summary'\n"
            "Return ONLY a JSON object containing keys:\n"
            '- "content" (the redesigned, beautifully formatted study note markdown)\n'
            '- "content_type" (one of: "definition", "example", "code", "concept", "summary")\n'
            "Do not add any markdown block wrappers around the JSON, no code block tickmarks, only return the JSON object."
        )
        
        batch_size = 4
        for i in range(0, len(raw_chunks), batch_size):
            batch = raw_chunks[i:i+batch_size]
            tasks = []
            for chunk in batch:
                tasks.append(self._design_single_chunk(chunk, ai_client, system_prompt))
            results = await asyncio.gather(*tasks)
            designed_chunks.extend(results)
            
            # Short sleep between batches to avoid rate limits
            if i + batch_size < len(raw_chunks):
                await asyncio.sleep(1.5)
                
        return designed_chunks
