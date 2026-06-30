import asyncio
from langchain_core.messages import SystemMessage, HumanMessage
from backend.utils.crypto import decrypt_string
from backend.config import load_config

class AIClient:
    """Unified client for interacting with AI models (completions and embeddings).
    Supports OpenAI, Gemini, and Groq with rate-limit retry backoffs.
    """
    def __init__(self, provider: str, model: str, api_key: str):
        self.provider = provider.lower()
        self.model = model
        self.api_key = api_key
        self._llm = None
        self._setup_client()

    def _setup_client(self):
        """Initializes the underlying LangChain chat client."""
        if self.provider == "openai":
            from langchain_openai import ChatOpenAI
            self._llm = ChatOpenAI(
                model=self.model,
                api_key=self.api_key,
                temperature=0.0
            )
        elif self.provider == "groq":
            from langchain_groq import ChatGroq
            self._llm = ChatGroq(
                model=self.model,
                api_key=self.api_key,
                temperature=0.0
            )
        elif self.provider == "nvidia":
            from langchain_openai import ChatOpenAI
            self._llm = ChatOpenAI(
                model=self.model,
                api_key=self.api_key,
                base_url="https://integrate.api.nvidia.com/v1",
                temperature=0.0
            )
        elif self.provider == "openrouter":
            from langchain_openai import ChatOpenAI
            self._llm = ChatOpenAI(
                model=self.model,
                api_key=self.api_key,
                base_url="https://openrouter.ai/api/v1",
                temperature=0.0
            )
        elif self.provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            # Map standard gemini names if needed, ensure api_key is passed
            self._llm = ChatGoogleGenerativeAI(
                model=self.model,
                google_api_key=self.api_key,
                temperature=0.0
            )
        else:
            raise ValueError(f"Unsupported AI provider: {self.provider}")

    async def _complete_call(self, system: str, user: str, json_mode: bool) -> str:
        """Raw single API call runner."""
        messages = [
            SystemMessage(content=system),
            HumanMessage(content=user)
        ]
        
        # Configure JSON mode if requested
        kwargs = {}
        if json_mode:
            if self.provider in ["openai", "groq", "nvidia", "openrouter"]:
                kwargs["response_format"] = {"type": "json_object"}
            elif self.provider == "gemini":
                # For Gemini, model_kwargs response_mime_type configuration is cleaner
                kwargs["model_kwargs"] = {"response_mime_type": "application/json"}

        # Langchain complete invocation is synchronous, so run in executor to prevent blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self._llm.invoke(messages, **kwargs)
        )
        return response.content

    async def complete(self, system: str, user: str, json_mode: bool = True) -> str:
        """Sends a prompt to the model and returns the response content.
        Retries up to 5 times with exponential backoff on rate limits.
        """
        retries = 5
        delay = 4.0
        backoff_factor = 2.0

        for attempt in range(retries):
            try:
                return await self._complete_call(system, user, json_mode)
            except Exception as e:
                err_msg = str(e).lower()
                # Check for standard rate-limiting patterns in error messages
                is_rate_limit = (
                    "429" in err_msg or 
                    "rate" in err_msg or 
                    "limit" in err_msg or 
                    "quota" in err_msg or 
                    "tpm" in err_msg or 
                    "rpm" in err_msg or
                    "rate_limit_exceeded" in err_msg
                )
                
                if is_rate_limit and attempt < retries - 1:
                    print(f"[{self.provider}] Rate limited. Retrying in {delay}s... (Attempt {attempt + 1}/{retries})")
                    await asyncio.sleep(delay)
                    delay *= backoff_factor
                else:
                    # Reraise original exception if max retries exceeded or not a rate-limit error
                    raise e

    async def complete_with_image(self, system: str, user: str, image_base64: str) -> str:
        """Sends a text prompt along with a base64 encoded image to the model."""
        if self.provider in ["openai", "nvidia", "openrouter", "groq"]:
            content = [
                {"type": "text", "text": user},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_base64}"}
                }
            ]
            messages = [
                SystemMessage(content=system),
                HumanMessage(content=content)
            ]
        elif self.provider == "gemini":
            content = [
                {"type": "text", "text": user},
                {
                    "type": "image_url",
                    "image_url": f"data:image/png;base64,{image_base64}"
                }
            ]
            messages = [
                SystemMessage(content=system),
                HumanMessage(content=content)
            ]
        else:
            raise ValueError(f"Multimodal completion not supported for provider: {self.provider}")

        # Run invocation in executor
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self._llm.invoke(messages)
        )
        return response.content

    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generates embeddings for the list of texts.
        If the provider is Groq, falls back to Gemini or OpenAI if keys are present,
        otherwise uses local sentence-transformers default (via ChromaDB default embedder).
        """
        if not texts:
            return []

        # If provider is OpenAI
        if self.provider == "openai":
            from langchain_openai import OpenAIEmbeddings
            embedder = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=self.api_key
            )
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: embedder.embed_documents(texts))
            
        # If provider is Gemini
        elif self.provider == "gemini":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            embedder = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=self.api_key
            )
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: embedder.embed_documents(texts))

        # Groq has no native embeddings, so check if other providers are configured
        config = load_config()
        
        # Check Gemini
        gemini_key = config.api_keys.get("gemini")
        if gemini_key:
            decrypted_key = decrypt_string(gemini_key)
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            embedder = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=decrypted_key
            )
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: embedder.embed_documents(texts))

        # Check OpenAI
        openai_key = config.api_keys.get("openai")
        if openai_key:
            decrypted_key = decrypt_string(openai_key)
            from langchain_openai import OpenAIEmbeddings
            embedder = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=decrypted_key
            )
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: embedder.embed_documents(texts))

        # Fallback: local CPU sentence-transformers embedding function via Chroma default
        import chromadb.utils.embedding_functions as embedding_functions
        ef = embedding_functions.DefaultEmbeddingFunction()
        # Chroma DefaultEmbeddingFunction returns list of np.ndarray or list of floats
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(None, lambda: ef(texts))
        # Ensure it is standard list of floats
        return [list(map(float, emb)) for emb in embeddings]


def get_ai_client(task_type: str = "extraction") -> AIClient:
    """Helper to instantiate an AIClient using the configured preferences for a task type.
    task_type can be 'extraction', 'tagging', or 'reasoning'.
    """
    config = load_config()
    model_pref = config.model_prefs.get(task_type)

    if not model_pref:
        # No model configured for this task, fall back to first configured provider
        providers = [k for k, v in config.api_keys.items() if v]
        if not providers:
            raise ValueError("No AI providers configured. Please configure API keys in Settings first.")
        provider = providers[0]
        if provider == "groq":
            model = "llama-3.3-70b-versatile"
        elif provider == "nvidia":
            model = "meta/llama-3.3-70b-instruct"
        elif provider == "openrouter":
            model = "meta-llama/llama-3.3-70b-instruct"
        elif provider == "gemini":
            model = "gemini-1.5-flash"
        elif provider == "openai":
            model = "gpt-4o-mini"
        else:
            raise ValueError(f"Unknown provider: {provider}")
    else:
        if ":" in model_pref:
            provider, model = model_pref.split(":", 1)
        else:
            # Backward-compatible parsing
            model = model_pref
            model_lower = model.lower()
            if model_lower.startswith("gemini-"):
                provider = "gemini"
            elif model_lower.startswith("gpt-"):
                provider = "openai"
            elif "/" in model_lower:
                provider = "nvidia"
            else:
                provider = "groq"

    encrypted_key = config.api_keys.get(provider)
    if not encrypted_key:
        raise ValueError(f"API key for provider '{provider}' is not configured.")

    api_key = decrypt_string(encrypted_key)
    return AIClient(provider=provider, model=model, api_key=api_key)
