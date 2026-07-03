@echo off
setlocal
setlocal EnableDelayedExpansion

REM ============================================
REM AozoraTeX Studio 起動用バッチファイル
REM ============================================
REM このファイルを実行すると Next.js 開発サーバーを起動し、
REM ブラウザを自動で開きます。
REM
REM 使い方:
REM   このファイルをダブルクリックするだけです。
REM ============================================

REM スクリプトがある場所（プロジェクトのルート）に移動
cd /d "%~dp0"

REM --------------------------------------------
REM 設定
REM --------------------------------------------
set "SERVER_URL=http://127.0.0.1:3000"
set "HEALTH_URL=%SERVER_URL%/api/devices"
set "MAX_RETRIES=40"
set "WAIT_SECONDS=1"

echo ============================================
echo   AozoraTeX Studio を起動します
echo   URL: %SERVER_URL%
echo ============================================
echo.

REM --------------------------------------------
REM Bun か npm かを自動判別して起動
REM --------------------------------------------
where bun >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo [1/3] Bun が見つかりました。Bun で起動します...
    start "AozoraTeX Studio (Bun)" cmd /c "bun run dev || pause"
) else (
    echo [1/3] Bun が見つかりません。npm で起動します...
    start "AozoraTeX Studio (npm)" cmd /c "npm run dev || pause"
)

echo.
echo [2/3] サーバーが起動するまで待機しています...

REM --------------------------------------------
REM サーバーが応答するまで待つ（最大40秒）
REM --------------------------------------------
set "SERVER_READY=0"
for /L %%I in (1,1,%MAX_RETRIES%) do (
    REM /api/devices が 200 を返したらサーバー起動済みとみなす
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try { $r = Invoke-WebRequest -Uri '%HEALTH_URL%' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch { exit 1 }" >nul 2>&1

    if !ERRORLEVEL! EQU 0 (
        set "SERVER_READY=1"
        goto :open_browser
    )

    timeout /t %WAIT_SECONDS% /nobreak >nul
)

REM --------------------------------------------
REM ブラウザを開く
REM --------------------------------------------
:open_browser
echo.
if "%SERVER_READY%"=="1" (
    echo [3/3] サーバーの準備ができました。ブラウザを開きます。
    start "" "%SERVER_URL%"
) else (
    echo [3/3] サーバーの起動確認がタイムアウトしました。
    echo       とりあえずブラウザを開きます。
    start "" "%SERVER_URL%"
)

echo.
echo 完了しました。ブラウザで以下を開いてください:
echo   %SERVER_URL%
echo.
echo 終了するにはこのウィンドウを閉じてください。

endlocal
