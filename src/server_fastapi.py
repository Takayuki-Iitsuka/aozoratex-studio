#!/usr/bin/env python3
"""
server_fastapi.py

長寿命Pythonサーバー (FastAPI) の実験的実装。
提案に基づくブリッジ改善のOption B/C代替。

利点:
- 毎回subprocess spawn のオーバーヘッドを排除
- ログストリーミングに WebSocket / SSE を自然に利用可能
- 状態保持 (キャッシュ等) がしやすい

使用例 (開発時):
  uv pip install -e ".[dev]"
  .venv\Scripts\python.exe -m src.server_fastapi

Next.js 側からは http://127.0.0.1:8765 へプロキシ推奨 (next.config や route handler)。

現時点では完全互換ではなく「雛形」。本番は api_bridge + spawn のままでも可。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

# プロジェクトルートをパスに追加
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn

from src import server_services
from src import settings_store

app = FastAPI(title="AozoraTeX FastAPI Bridge (実験的)")

@app.get("/health")
async def health():
    return {"status": "ok", "bridge": "fastapi-experimental"}

@app.get("/devices")
async def get_devices():
    payload = settings_store.get_device_api_payload()
    return JSONResponse(payload)

@app.get("/settings")
async def get_settings():
    payload = settings_store.export_settings_for_api()
    return {"success": True, "settings": payload}

@app.post("/settings")
async def save_settings(req: Request):
    data = await req.json()
    updated = settings_store.save_settings(data)
    return {"success": True, "settings": updated}

@app.post("/generate")
async def generate(req: Request):
    """
    ストリーミング生成 (SSE風)。
    クライアントは EventSource や fetch reader で扱う。
    """
    body = await req.json()
    source = body.get("source")
    device = body.get("device")
    bg_color = body.get("bg_color", "#FFFFFF")
    fg_color = body.get("fg_color", "#000000")
    font_family = body.get("font_family")
    decorations = body.get("decorations") or {}

    def event_generator():
        def emit_log(line: str):
            yield f"data: {json.dumps({'type': 'log', 'content': line})}\n\n"

        ok, payload, status = server_services.generate_single(
            source=source,
            device=device,
            bg_color=bg_color,
            fg_color=fg_color,
            font_family=font_family,
            compile_pdf=body.get("compile_pdf", True),
            decorations=decorations,
            emit_log=lambda l: None,  # 実際は yield する必要あり (簡易)
        )
        payload["success"] = ok
        yield f"data: {json.dumps({'type': 'result', 'data': payload})}\n\n"

    # 簡易実装: 実際のストリーミングは emit_log を generator に繋ぐ必要
    # 完全版は server_services の emit を async generator に移譲
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# 他のエンドポイント (colors, fonts, session など) は同様に追加可能

if __name__ == "__main__":
    print("Starting experimental FastAPI bridge on http://127.0.0.1:8765")
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
