import os
import json
import shutil
from datetime import datetime
from pydantic import BaseModel, Field

CONFIG_DIR = os.path.expanduser("~/.prephelper")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")
CONFIG_BAK_PATH = os.path.join(CONFIG_DIR, "config.json.bak")

class AppConfig(BaseModel):
    port: int = 8765
    vault_path: str | None = None
    api_keys: dict[str, str] = Field(default_factory=dict)
    model_prefs: dict[str, str] = Field(default_factory=dict)

def load_config() -> AppConfig:
    """Loads configuration from ~/.prephelper/config.json, falling back to defaults if not present or corrupt."""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return AppConfig(**data)
        except Exception:
            # If parsing fails, fall back to default
            pass
    return AppConfig()

def save_config(config: AppConfig):
    """Saves config to ~/.prephelper/config.json. Backs up existing config to config.json.bak first."""
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if os.path.exists(CONFIG_PATH):
        try:
            shutil.copy2(CONFIG_PATH, CONFIG_BAK_PATH)
        except Exception:
            pass
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, indent=4)

def is_vault_configured() -> bool:
    """Returns True if the vault_path is set in config and exists on disk."""
    config = load_config()
    if not config.vault_path:
        return False
    return os.path.exists(config.vault_path) and os.path.isdir(config.vault_path)

def init_vault(path: str):
    """Initializes the vault folder structure at the specified path and writes the metadata file."""
    # Ensure path is absolute
    abs_path = os.path.abspath(path)
    # Create vault subdirectories
    subdirs = ["uploads", "exports", "db", "chroma", "logs"]
    for subdir in subdirs:
        os.makedirs(os.path.join(abs_path, subdir), exist_ok=True)
    
    # Write metadata file
    meta_path = os.path.join(abs_path, ".prephelper_meta.json")
    meta_data = {
        "version": "1.0",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "schema_version": 1
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_data, f, indent=4)
