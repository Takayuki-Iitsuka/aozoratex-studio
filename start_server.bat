@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=.venv\Scripts\python.exe"
if exist "%PYTHON_EXE%" (
    "%PYTHON_EXE%" app.py
) else (
    python app.py
)

endlocal

