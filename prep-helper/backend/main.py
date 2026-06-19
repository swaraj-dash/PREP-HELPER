import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.config import load_config, is_vault_configured
from backend.database import init_db
from backend.routers import settings

app = FastAPI(title="Prep Helper", version="1.0.0")

# Setup CORS to allow cross-origin requests from frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Startup handler: checks if vault is configured and initializes SQL database."""
    config = load_config()
    print(f"Prep Helper backend starting on port {config.port}...")
    if is_vault_configured():
        print(f"Vault detected at: {config.vault_path}. Initializing database...")
        try:
            await init_db()
            print("Database initialized successfully.")
        except Exception as e:
            print(f"Error initializing database: {e}")
    else:
        print("Vault is not configured yet. Set up a vault folder via Settings in the UI.")

# Register API Routers
app.include_router(settings.router, prefix="/api")

@app.get("/api/health")
def health():
    """Health check endpoint: returns status and vault configuration status."""
    return {
        "status": "ok",
        "vault_configured": is_vault_configured(),
        "version": "1.0.0"
    }

# Serve React frontend build in production mode
frontend_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))

if os.path.exists(frontend_dist_path):
    # Mount assets directory for JS, CSS, and image files
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    # Catch-all route to serve the built index.html for React Router routing compatibility
    @app.get("/{catchall:path}")
    async def serve_react_app(catchall: str):
        if catchall.startswith("api/"):
            return None
        index_file = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"error": "React production build files not found."}
else:
    @app.get("/{catchall:path}")
    async def dev_mode_catchall(catchall: str):
        if catchall.startswith("api/"):
            return None
        return {
            "message": "FastAPI running in development mode. Please run Vite dev server at http://localhost:5173 to access user interface."
        }
