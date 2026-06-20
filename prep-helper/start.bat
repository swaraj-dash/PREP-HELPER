@echo off
cd /d "%~dp0"

REM Activate virtual environment if it exists
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM Run launcher using python
python launcher.py %*
if %ERRORLEVEL% neq 0 (
    echo Launcher encountered an error.
    pause
)
