import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from backend.config import load_config

Base = declarative_base()

# Global variables for dynamic database engine and session factory
_engine = None
_sessionmaker = None

def get_engine():
    """Dynamically builds or retrieves the SQLAlchemy engine pointing to prephelper.sqlite in the vault."""
    global _engine
    config = load_config()
    if not config.vault_path:
        raise ValueError("Vault is not configured. Please configure vault_path first.")
    
    db_dir = os.path.join(config.vault_path, "db")
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, "prephelper.sqlite")
    
    # Use standard forward slashes for SQLite connection URI compatibility, especially on Windows
    normalized_path = os.path.abspath(db_path).replace("\\", "/")
    db_url = f"sqlite+aiosqlite:///{normalized_path}"
    
    if _engine is None or str(_engine.url) != db_url:
        # Create new engine
        _engine = create_async_engine(db_url, echo=False, future=True)
    return _engine

def get_sessionmaker():
    """Gets the async session maker dynamically bound to the current engine."""
    global _sessionmaker
    engine = get_engine()
    if _sessionmaker is None or _sessionmaker.kw.get("bind") != engine:
        _sessionmaker = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
    return _sessionmaker

async def get_db():
    """FastAPI async dependency yielding an active DB session."""
    session_factory = get_sessionmaker()
    async with session_factory() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    """Initializes all tables in the SQLite database."""
    # Import models here to register them with Base.metadata and prevent circular imports
    from backend import models
    from backend.utils.tag_vocab import seed_tags
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Open session to perform seeding
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        try:
            await seed_tags(session)
        except Exception as e:
            # Let it fail gracefully or log it
            print(f"Error seeding tags vocabulary: {e}")

