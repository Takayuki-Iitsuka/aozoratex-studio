@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=.venv\Scripts\python.exe"
if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" -m src.aozora_server
) else (
    python -m src.aozora_server
)

endlocal

