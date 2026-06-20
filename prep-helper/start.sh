#!/bin/bash
cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
  source venv/bin/activate
fi

# Run launcher using python or python3
if command -v python &>/dev/null; then
  python launcher.py "$@"
elif command -v python3 &>/dev/null; then
  python3 launcher.py "$@"
else
  echo "Error: Python is not installed or not in PATH."
  exit 1
fi
