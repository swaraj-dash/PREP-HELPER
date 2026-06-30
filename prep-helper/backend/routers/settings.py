import os
import httpx
from fastapi import APIRouter, HTTPException
from backend.config import load_config, save_config, is_vault_configured, init_vault
from backend.database import init_db
from backend.utils.crypto import encrypt_string, decrypt_string
from backend.schemas.settings import SettingsOut, SettingsUpdate, TestKeyRequest, VaultSetupRequest

router = APIRouter(tags=["settings"])

DEFAULT_PROVIDER_MODELS = {
    "groq": [
        "llama-3.3-70b-versatile", 
        "llama-3.1-8b-instant"
    ],
    "nvidia": [
        "meta/llama-3.3-70b-instruct",
        "meta/llama-3.1-70b-instruct",
        "nvidia/llama-3.1-nemotron-70b-instruct",
        "meta/llama-3.1-8b-instruct",
        "google/gemma-2-9b-it",
        "google/gemma-2-27b-it",
        "mistralai/mixtral-8x7b-instruct-v0.1",
        "mistralai/mistral-large-2-instruct"
    ],
    "openrouter": [
        "meta-llama/llama-3.3-70b-instruct",
        "google/gemini-2.5-flash",
        "google/gemini-2.5-pro",
        "anthropic/claude-3.5-sonnet",
        "anthropic/claude-3-haiku",
        "openai/gpt-4o-mini",
        "openai/gpt-4o",
        "deepseek/deepseek-chat"
    ]
}

def _get_available_models(config):
    available = {}
    for provider, models in DEFAULT_PROVIDER_MODELS.items():
        if config.api_keys.get(provider):
            available[provider] = models
    return available

async def _get_all_limits(config):
    limits = {}
    openrouter_key = config.api_keys.get("openrouter")
    if openrouter_key:
        try:
            decrypted_key = decrypt_string(openrouter_key)
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {decrypted_key}",
                    "HTTP-Referer": "https://prephelper.local",
                    "X-Title": "Prep Helper"
                }
                resp = await client.get("https://openrouter.ai/api/v1/key", headers=headers, timeout=5.0)
                if resp.status_code == 200:
                    data = resp.json()
                    if "data" in data:
                        kd = data["data"]
                        limits["openrouter"] = {
                            "limit": kd.get("limit"),
                            "limit_remaining": kd.get("limit_remaining"),
                            "usage": kd.get("usage"),
                            "is_free": kd.get("limit") is None and kd.get("limit_remaining") is None
                        }
        except Exception as e:
            print(f"[Settings] Failed to fetch OpenRouter limits: {e}")
    return limits

@router.get("/settings", response_model=SettingsOut)
async def get_settings():
    """Returns the current settings. API keys are masked in the response."""
    config = load_config()
    providers = []
    for k, v in config.api_keys.items():
        if v:
            providers.append(k)
            
    limits = await _get_all_limits(config)
            
    return SettingsOut(
        vault_path=config.vault_path,
        vault_configured=is_vault_configured(),
        model_prefs=config.model_prefs,
        providers_configured=providers,
        available_models=_get_available_models(config),
        limits=limits
    )

@router.post("/settings", response_model=SettingsOut)
async def update_settings(payload: SettingsUpdate):
    """Saves settings, encrypting any newly entered API keys at rest."""
    config = load_config()
    
    # Update API keys
    for provider, key in payload.api_keys.items():
        provider_key = provider.lower()
        if key:
            if key == "***":
                # Retain existing key if user didn't modify it
                continue
            config.api_keys[provider_key] = encrypt_string(key)
        else:
            config.api_keys[provider_key] = ""
            
    # Update model preferences
    for task, model in payload.model_prefs.items():
        config.model_prefs[task] = model
        
    save_config(config)
    
    providers = [k for k, v in config.api_keys.items() if v]
    limits = await _get_all_limits(config)
    
    return SettingsOut(
        vault_path=config.vault_path,
        vault_configured=is_vault_configured(),
        model_prefs=config.model_prefs,
        providers_configured=providers,
        available_models=_get_available_models(config),
        limits=limits
    )

@router.post("/vault/setup")
async def setup_vault_endpoint(payload: VaultSetupRequest):
    """Sets up a new or existing directory as the local Vault, initializing SQLite tables."""
    path = payload.vault_path
    if not os.path.isabs(path):
        raise HTTPException(status_code=400, detail="Vault path must be an absolute path.")
        
    try:
        # Create vault directories
        init_vault(path)
        
        # Save vault path to config
        config = load_config()
        config.vault_path = path
        save_config(config)
        
        # Initialize SQLite database tables
        await init_db()
        
        return {"success": True, "vault_path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize vault: {str(e)}")

@router.post("/settings/test-key")
async def test_key_endpoint(payload: TestKeyRequest):
    """Performs a lightweight verification call to the selected provider to test the API key."""
    provider = payload.provider.lower()
    key = payload.api_key
    
    if key == "***":
        # Decrypt from local config if masked
        config = load_config()
        encrypted_key = config.api_keys.get(provider)
        if not encrypted_key:
            return {"valid": False, "error": "No key configured."}
        key = decrypt_string(encrypted_key)
        
    if not key:
        return {"valid": False, "error": "API key cannot be empty."}
        
    valid = False
    supported = []
    
    try:
        if provider == "groq":
            from groq import AsyncGroq
            client = AsyncGroq(api_key=key)
            models_response = await client.models.list()
            for m in models_response.data:
                mid = m.id
                if any(x in mid.lower() for x in ["llama", "mixtral", "gemma"]):
                    supported.append(mid)
            supported = sorted(list(set(supported)))
            if not supported:
                supported = DEFAULT_PROVIDER_MODELS["groq"]
            valid = True
        elif provider == "nvidia":
            import openai
            client = openai.AsyncOpenAI(api_key=key, base_url="https://integrate.api.nvidia.com/v1")
            models_response = await client.models.list()
            for m in models_response.data:
                mid = m.id
                if any(x in mid.lower() for x in ["llama", "gemma", "mixtral", "mistral", "nemotron"]) and "instruct" in mid.lower():
                    supported.append(mid)
            supported = sorted(list(set(supported)))
            if not supported:
                supported = DEFAULT_PROVIDER_MODELS["nvidia"]
            valid = True
        elif provider == "openrouter":
            import openai
            client = openai.AsyncOpenAI(api_key=key, base_url="https://openrouter.ai/api/v1")
            models_response = await client.models.list()
            for m in models_response.data:
                mid = m.id
                mid_lower = mid.lower()
                if any(x in mid_lower for x in ["llama", "gemini", "claude", "gpt-4", "gpt-3.5", "deepseek", "mixtral", "mistral", "gemma"]):
                    if not any(x in mid_lower for x in ["embedding", "moderation", "search", "similarity"]):
                        supported.append(mid)
            supported = sorted(list(set(supported)))
            if not supported:
                supported = DEFAULT_PROVIDER_MODELS["openrouter"]
            valid = True
        else:
            return {"valid": False, "error": f"Unknown provider '{provider}'"}
            
        if valid:
            config = load_config()
            config.api_keys[provider] = encrypt_string(key)
            save_config(config)
            return {"valid": True, "models": supported}
            
    except Exception as e:
        return {"valid": False, "error": str(e)}
