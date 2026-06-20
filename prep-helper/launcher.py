import os
import sys
import subprocess
import time
import urllib.request
import urllib.error
import webbrowser
import argparse
import signal

# Define paths relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(SCRIPT_DIR, "venv")
BACKEND_DIR = os.path.join(SCRIPT_DIR, "backend")
FRONTEND_DIR = os.path.join(SCRIPT_DIR, "frontend")
FRONTEND_DIST_DIR = os.path.join(FRONTEND_DIR, "dist")
PORT = 8765

# Determine correct paths for python, pip, uvicorn, npm depending on OS
if sys.platform.startswith("win"):
    PYTHON_EXE = os.path.join(VENV_DIR, "Scripts", "python.exe")
    PIP_EXE = os.path.join(VENV_DIR, "Scripts", "pip.exe")
    UVICORN_EXE = os.path.join(VENV_DIR, "Scripts", "uvicorn.exe")
    NPM_CMD = "npm.cmd"
else:
    PYTHON_EXE = os.path.join(VENV_DIR, "bin", "python")
    PIP_EXE = os.path.join(VENV_DIR, "bin", "pip")
    UVICORN_EXE = os.path.join(VENV_DIR, "bin", "uvicorn")
    NPM_CMD = "npm"

def setup_venv():
    """Ensure virtual environment exists and all backend dependencies are installed."""
    if not os.path.exists(VENV_DIR):
        print(f"Creating virtual environment in {VENV_DIR}...")
        subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)
    
    # Check if python executable exists inside venv
    if not os.path.exists(PYTHON_EXE):
        print("Virtual environment exists but appears to be broken. Re-creating...")
        subprocess.run([sys.executable, "-m", "venv", VENV_DIR], check=True)

    print("Checking/installing backend dependencies...")
    requirements_path = os.path.join(BACKEND_DIR, "requirements.txt")
    
    # Ensure pip is upgraded
    subprocess.run([PIP_EXE, "install", "--upgrade", "pip"], check=True)
    # Install dependencies
    subprocess.run([PIP_EXE, "install", "-r", requirements_path], check=True)

def build_frontend(force_rebuild=False):
    """Build the frontend React app if needed."""
    needs_build = not os.path.exists(FRONTEND_DIST_DIR) or force_rebuild
    
    if needs_build:
        print("Building React frontend...")
        node_modules_dir = os.path.join(FRONTEND_DIR, "node_modules")
        if not os.path.exists(node_modules_dir):
            print("Installing frontend dependencies (npm install)...")
            subprocess.run([NPM_CMD, "install"], cwd=FRONTEND_DIR, check=True)
        
        print("Running production build (npm run build)...")
        subprocess.run([NPM_CMD, "run", "build"], cwd=FRONTEND_DIR, check=True)
    else:
        print("Frontend production build already exists. Skipping build. (Use --rebuild to force rebuild)")

def poll_health(url, timeout=30):
    """Poll the health check URL until it responds with 200 OK or timeout is reached."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'PrepHelper-Launcher'})
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    return True
        except urllib.error.URLError:
            pass
        time.sleep(0.5)
    return False

def main():
    parser = argparse.ArgumentParser(description="Prep Helper Launcher")
    parser.add_argument("--rebuild", action="store_true", help="Force rebuild the frontend assets")
    parser.add_argument("--host", default="127.0.0.1", help="Backend host address")
    parser.add_argument("--port", type=int, default=PORT, help="Backend port number")
    args = parser.parse_args()

    # 1. Setup virtual environment
    setup_venv()

    # 2. Build React app if needed
    build_frontend(force_rebuild=args.rebuild)

    # 3. Start uvicorn server in a subprocess
    env = os.environ.copy()
    env["PYTHONPATH"] = SCRIPT_DIR

    print(f"Starting backend server on port {args.port}...")
    cmd = [UVICORN_EXE, "backend.main:app", "--host", args.host, "--port", str(args.port)]
    
    proc = subprocess.Popen(cmd, env=env, cwd=SCRIPT_DIR)

    def cleanup():
        print("\nShutting down backend server...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Server shutdown completed.")

    # Register process signals for clean exit
    def signal_handler(signum, frame):
        cleanup()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # 4. Wait for server to become responsive
    health_url = f"http://{args.host}:{args.port}/api/health"
    print("Waiting for server to become responsive...")
    
    try:
        if poll_health(health_url):
            print("Server is responsive.")
            # 5. Open default web browser
            webbrowser.open(f"http://{args.host}:{args.port}")
            print(f"\n============================================================")
            print(f"Prep Helper running at http://{args.host}:{args.port}")
            print(f"Press Ctrl+C to stop the server")
            print(f"============================================================\n")
            
            # Wait for backend process to terminate
            proc.wait()
        else:
            print("Error: Server failed to start or become responsive within timeout limit.")
            cleanup()
            sys.exit(1)
    except KeyboardInterrupt:
        cleanup()
        sys.exit(0)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        cleanup()
        sys.exit(1)

if __name__ == "__main__":
    main()
