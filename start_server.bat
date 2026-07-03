@echo off
setlocal
setlocal EnableDelayedExpansion

REM Run from project root (the batch file location).
cd /d "%~dp0"

REM Prefer project venv when available; fall back to system python.
set "PYTHON_EXE=.venv\Scripts\python.exe"
set "SERVER_URL=http://127.0.0.1:5000"
set "HEALTH_URL=%SERVER_URL%/health"
set "MAX_RETRIES=30"
set "WAIT_SECONDS=1"

REM Start the server first, then open browser after health-check passes.
if exist "%PYTHON_EXE%" (
    start "AozoraTeX Server" cmd /c ""%PYTHON_EXE%" -m src.aozora_server || pause"
) else (
    start "AozoraTeX Server" cmd /c "python -m src.aozora_server || pause"
)

set "SERVER_READY=0"
for /L %%I in (1,1,%MAX_RETRIES%) do (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $resp = Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 2; if ($resp.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "SERVER_READY=1"
        goto :open_browser
    )
    timeout /t %WAIT_SECONDS% /nobreak >nul
)

:open_browser
if "%SERVER_READY%"=="1" (
    start "" "%SERVER_URL%"
) else (
    echo [WARN] Server readiness check timed out. Opening browser anyway.
    start "" "%SERVER_URL%"
)

endlocal
