from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class SettingsOut(BaseModel):
    vault_path: Optional[str] = None
    vault_configured: bool
    model_prefs: Dict[str, str] = Field(default_factory=dict)
    providers_configured: List[str] = Field(default_factory=list)

class SettingsUpdate(BaseModel):
    api_keys: Dict[str, str] = Field(default_factory=dict)  # {"gemini": "AIza...", "openai": "sk-...", "groq": "gsk-..."}
    model_prefs: Dict[str, str] = Field(default_factory=dict)  # {"extraction": "gemini-1.5-flash", ...}

class TestKeyRequest(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None

class VaultSetupRequest(BaseModel):
    vault_path: str
