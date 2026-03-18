@echo off
setlocal

REM Run from project root (the batch file location).
cd /d "%~dp0"

REM Prefer project venv when available; fall back to system python.
set "PYTHON_EXE=.venv\Scripts\python.exe"
if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" -m src.aozora_server
) else (
    python -m src.aozora_server
)

endlocal
