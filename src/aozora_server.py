#!/usr/bin/env python3
"""
aozoratex Web Server

青空文庫HTMLから、デバイス・配色をカスタマイズしたLuaLaTeX PDFを生成するWebUI。

フロー:
  1. HTML選択 → 2. デバイス選択 → 3. 配色選択 → 4. プレビュー → 5. PDF/TEX生成
"""

from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory,
    redirect,
    Response,
    abort,
)
from pathlib import Path
import subprocess
import logging
import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional

from src import settings_store
from src import server_services

# ---- 設定 ----
WORKDIR = Path(__file__).resolve().parent.parent
app = Flask(
    __name__,
    static_folder=None,
)
DATA_DIR = WORKDIR / "data"
OUT_DIR = WORKDIR / "out"
WORK_OUT_DIR = OUT_DIR / "work"
PDF_OUT_DIR = OUT_DIR / "pdf"
STATIC_DIR = WORKDIR / "static"
DOCS_DIR = STATIC_DIR / "docs"
MAX_COLOR_SCHEMES = server_services.MAX_COLOR_SCHEMES
THEME_COMMON_CSS_PATH = "/static/css/theme-common.css"
THEME_COMMON_JS_PATH = "/static/js/theme-common.js"

_RUNTIME_INITIALIZED = False
_RUNTIME_INIT_LOCK = threading.Lock()


class _ColorFormatter(logging.Formatter):
    COLORS = {
        logging.DEBUG: "\033[36m",
        logging.INFO: "\033[32m",
        logging.WARNING: "\033[33m",
        logging.ERROR: "\033[31m",
        logging.CRITICAL: "\033[35m",
    }
    RESET = "\033[0m"

    def __init__(self, use_color: bool) -> None:
        super().__init__("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
        self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        base = super().format(record)
        if not self.use_color:
            return base
        color = self.COLORS.get(record.levelno, "")
        return f"{color}{base}{self.RESET}" if color else base


def _supports_color_output() -> bool:
    if os.getenv("NO_COLOR"):
        return False
    stream = getattr(sys, "stdout", None)
    if stream is None or not hasattr(stream, "isatty") or not stream.isatty():
        return False

    if os.name == "nt":
        try:
            # Enable ANSI escape sequence processing on modern Windows console.
            os.system("")
        except Exception:
            return False
        return True
    return True


def _configure_logging() -> logging.Logger:
    root = logging.getLogger()
    root.handlers.clear()

    handler = logging.StreamHandler()
    handler.setFormatter(_ColorFormatter(use_color=_supports_color_output()))
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    flask_logger = logging.getLogger("werkzeug")
    flask_logger.setLevel(logging.INFO)

    return logging.getLogger(__name__)


logger = _configure_logging()


def _delayed_shutdown(shutdown_func: object, delay_seconds: float = 0.25) -> None:
    time.sleep(max(0.0, delay_seconds))
    if callable(shutdown_func):
        try:
            shutdown_func()
        except Exception as exc:
            logger.exception("Failed to shutdown server: %s", exc)


def _spawn_restart_process(delay_seconds: int = 2) -> tuple[bool, str]:
    python_exe = _resolve_python_executable()
    delay = max(1, int(delay_seconds))

    if os.name == "nt":
        cmd = [
            "cmd",
            "/c",
            f'timeout /t {delay} /nobreak >nul && "{python_exe}" -m src.aozora_server',
        ]
        creation_flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    else:
        cmd = ["sh", "-c", f'sleep {delay}; "{python_exe}" -m src.aozora_server']
        creation_flags = 0

    logger.info("[server-control] restart command: %s", _command_to_log_text(cmd))
    try:
        subprocess.Popen(
            cmd,
            cwd=WORKDIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creation_flags,
        )
    except OSError as exc:
        return False, str(exc)
    return True, "restart scheduled"


def _safe_mkdir(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        logger.warning("Cannot create directory %s: %s", path, exc)


def _inject_theme_assets(html_text: str) -> str:
    """すべての HTML に共通テーマCSS/JSを注入する。"""
    result = html_text
    css_tag = f'<link rel="stylesheet" href="{THEME_COMMON_CSS_PATH}">'
    js_tag = f'<script src="{THEME_COMMON_JS_PATH}" defer></script>'

    if THEME_COMMON_CSS_PATH not in result:
        if "</head>" in result:
            result = result.replace("</head>", f"    {css_tag}\n</head>", 1)
        else:
            result = css_tag + "\n" + result

    if THEME_COMMON_JS_PATH not in result:
        if "</body>" in result:
            result = result.replace("</body>", f"    {js_tag}\n</body>", 1)
        else:
            result = result + "\n" + js_tag

    return result


def _serve_html_file_with_theme(file_path: Path) -> Response:
    if not file_path.exists() or not file_path.is_file():
        abort(404)
    html_text = file_path.read_text(encoding="utf-8")
    injected = _inject_theme_assets(html_text)
    return Response(injected, mimetype="text/html; charset=utf-8")


def _resolve_safe_static_html_path(filename: str) -> Optional[Path]:
    candidate = (STATIC_DIR / filename).resolve()
    try:
        candidate.relative_to(STATIC_DIR.resolve())
    except ValueError:
        return None
    return candidate


def _initialize_runtime_once() -> None:
    global _RUNTIME_INITIALIZED
    if _RUNTIME_INITIALIZED:
        return
    with _RUNTIME_INIT_LOCK:
        if _RUNTIME_INITIALIZED:
            return
        server_services.initialize_runtime()
        _RUNTIME_INITIALIZED = True


def _command_to_log_text(cmd: list[str]) -> str:
    return server_services.command_to_log_text(cmd)


def _load_lualatex_fonts(refresh: bool) -> tuple[list[dict], dict]:
    return server_services.load_lualatex_fonts(refresh)


def _build_color_schemes(mode: str) -> list[dict]:
    return server_services.build_color_schemes(mode)


def _limit_color_schemes_balanced(schemes: list[dict], limit: int) -> list[dict]:
    return server_services.limit_color_schemes_balanced(schemes, limit)


def _to_bool(value: object, default: bool = False) -> bool:
    return server_services.to_bool(value, default=default)


def _resolve_generation_defaults(
    device: Optional[str],
    mode: Optional[str],
    bg_color: Optional[str],
    fg_color: Optional[str],
) -> tuple[str, str, str, str]:
    return server_services.resolve_generation_defaults(device, mode, bg_color, fg_color)


def _resolve_decoration_options(payload: dict) -> dict[str, object]:
    return server_services.resolve_decoration_options(payload)


def _save_generation_preferences(
    device: str,
    mode: str,
    bg_color: str,
    fg_color: str,
    font_family: Optional[str] = None,
    decorations: Optional[dict[str, object]] = None,
) -> None:
    server_services.save_generation_preferences(
        device=device,
        mode=mode,
        bg_color=bg_color,
        fg_color=fg_color,
        font_family=font_family,
        decorations=decorations,
    )


def _resolve_python_executable() -> str:
    return server_services.resolve_python_executable()


def _list_source_files() -> list[dict]:
    return server_services.list_source_files()


def _normalize_source_input(source: object) -> Optional[str]:
    return server_services.normalize_source_input(source)


def _organize_session_outputs() -> dict:
    return server_services.organize_session_outputs()


def _cleanup_non_pdf_in_session() -> dict:
    return server_services.cleanup_non_pdf_in_session()


def _generate_single(
    source: str,
    device: str,
    mode: str,
    bg_color: str,
    fg_color: str,
    font_family: Optional[str],
    compile_pdf: bool,
    decorations: Optional[dict[str, object]] = None,
) -> tuple[bool, dict, int]:
    return server_services.generate_single(
        source=source,
        device=device,
        mode=mode,
        bg_color=bg_color,
        fg_color=fg_color,
        font_family=font_family,
        compile_pdf=compile_pdf,
        decorations=decorations,
    )


# ---- ルート ----


@app.after_request
def log_http_response(response: Response) -> Response:
    path = request.path or ""
    if path.startswith("/static/"):
        logger.debug("[http] %s %s -> %s", request.method, path, response.status_code)
    else:
        logger.info("[http] %s %s -> %s", request.method, path, response.status_code)
    return response


@app.before_request
def ensure_runtime_initialized() -> None:
    _initialize_runtime_once()


@app.route("/")
def index():
    """メイン画面"""
    return _serve_html_file_with_theme(STATIC_DIR / "index.html")


@app.route("/api/data-files")
def api_data_files():
    """data 配下の html/xhtml 一覧を返す。"""
    return jsonify({"files": _list_source_files()})


@app.route("/api/colors")
def api_colors():
    """配色パターン JSON API"""
    mode = request.args.get("mode", "light")
    limit_raw = request.args.get("limit")
    schemes = _build_color_schemes(mode)

    if limit_raw:
        try:
            limit = max(1, min(int(limit_raw), MAX_COLOR_SCHEMES))
            schemes = _limit_color_schemes_balanced(schemes, limit)
        except ValueError:
            pass
    else:
        schemes = _limit_color_schemes_balanced(schemes, MAX_COLOR_SCHEMES)

    return jsonify({"mode": mode, "schemes": schemes})


@app.route("/api/lualatex-fonts")
def api_lualatex_fonts():
    refresh = _to_bool(request.args.get("refresh"), default=False)
    fonts, meta = _load_lualatex_fonts(refresh)
    return jsonify({"success": True, "fonts": fonts, **meta})


@app.route("/api/devices")
def api_devices():
    """デバイス設定 JSON API"""
    return jsonify(settings_store.get_device_api_payload())


@app.route("/api/settings", methods=["GET"])
def api_settings_get():
    return jsonify(
        {"success": True, "settings": settings_store.export_settings_for_api()}
    )


@app.route("/api/settings", methods=["POST"])
def api_settings_save():
    payload = request.get_json() or {}
    if not isinstance(payload, dict):
        return jsonify(
            {"success": False, "error": "payload must be a JSON object"}
        ), 400
    settings = settings_store.save_settings(payload)
    return jsonify({"success": True, "settings": settings})


@app.route("/api/settings/reset", methods=["POST"])
def api_settings_reset():
    settings = settings_store.reset_custom_settings()
    return jsonify({"success": True, "settings": settings})


@app.route("/api/generate", methods=["POST"])
def api_generate():
    """
    LaTeX / PDF 生成API

    POST JSON:
    {
        "source": "data/xxx.html",
        "device": "iphone",
        "mode": "light",
        "bg_color": "#FFFFFF",
        "fg_color": "#000000"
    }

    戻り値: {"success": true, "tex_file": "...", "log": "..."}
    """
    data = request.get_json() or {}
    if not isinstance(data, dict):
        return jsonify(
            {"success": False, "error": "payload must be a JSON object"}
        ), 400

    source = _normalize_source_input(data.get("source"))
    device, mode, bg_color, fg_color = _resolve_generation_defaults(
        data.get("device"),
        data.get("mode"),
        data.get("bg_color"),
        data.get("fg_color"),
    )
    compile_pdf = _to_bool(data.get("compile_pdf"), default=True)
    font_family_raw = str(data.get("font") or "").strip()
    font_family = font_family_raw or None
    decorations = _resolve_decoration_options(data)

    if not source:
        return jsonify({"success": False, "error": "source is required"}), 400

    _save_generation_preferences(
        device,
        mode,
        bg_color,
        fg_color,
        font_family=font_family,
        decorations=decorations,
    )

    ok, payload, status = _generate_single(
        source=source,
        device=device,
        mode=mode,
        bg_color=bg_color,
        fg_color=fg_color,
        font_family=font_family,
        compile_pdf=compile_pdf,
        decorations=decorations,
    )
    payload["success"] = ok
    return jsonify(payload), status


@app.route("/api/generate-batch", methods=["POST"])
def api_generate_batch():
    """data 内の複数HTMLを選択または全件で PDF 生成する。"""
    data = request.get_json() or {}
    if not isinstance(data, dict):
        return jsonify(
            {"success": False, "error": "payload must be a JSON object"}
        ), 400

    device, mode, bg_color, fg_color = _resolve_generation_defaults(
        data.get("device"),
        data.get("mode"),
        data.get("bg_color"),
        data.get("fg_color"),
    )
    compile_pdf = _to_bool(data.get("compile_pdf"), default=True)
    font_family_raw = str(data.get("font") or "").strip()
    font_family = font_family_raw or None
    generate_all = _to_bool(data.get("generate_all"), default=False)
    decorations = _resolve_decoration_options(data)

    sources_raw = data.get("sources") or []
    if not isinstance(sources_raw, list):
        return jsonify({"success": False, "error": "sources must be a list"}), 400

    sources: list[str] = []
    if generate_all:
        sources = [entry["path"] for entry in _list_source_files()]
    else:
        for idx, source_raw in enumerate(sources_raw):
            normalized = _normalize_source_input(source_raw)
            if not normalized:
                return (
                    jsonify(
                        {
                            "success": False,
                            "error": f"sources[{idx}] must be a non-empty string",
                        }
                    ),
                    400,
                )
            sources.append(normalized)

    if not sources:
        return jsonify({"success": False, "error": "sources is empty"}), 400

    # 同一ファイル指定の重複コンパイルを防止する。
    sources = list(dict.fromkeys(sources))

    _save_generation_preferences(
        device,
        mode,
        bg_color,
        fg_color,
        font_family=font_family,
        decorations=decorations,
    )

    results: list[dict] = []
    failures: list[dict] = []

    def run_one(source: str) -> tuple[bool, dict]:
        ok, payload, _status = _generate_single(
            source=source,
            device=device,
            mode=mode,
            bg_color=bg_color,
            fg_color=fg_color,
            font_family=font_family,
            compile_pdf=compile_pdf,
            decorations=decorations,
        )
        payload["success"] = ok
        return ok, payload

    # PDF コンパイルありの並列化は CPU/IO 競合が大きいため逐次実行を維持する。
    use_parallel = (not compile_pdf) and len(sources) > 1
    if use_parallel:
        max_workers = min(4, len(sources), os.cpu_count() or 1)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            for ok, payload in executor.map(run_one, sources):
                results.append(payload)
                if not ok:
                    failures.append(payload)
    else:
        for source in sources:
            ok, payload = run_one(source)
            results.append(payload)
            if not ok:
                failures.append(payload)

    return jsonify(
        {
            "success": len(failures) == 0,
            "total": len(results),
            "success_count": len(results) - len(failures),
            "failure_count": len(failures),
            "results": results,
        }
    )


@app.route("/api/session/organize", methods=["POST"])
def api_session_organize():
    """out 直下を運用ルール（pdf/work）へ整理する。"""
    moved = _organize_session_outputs()
    return jsonify({"success": True, **moved})


@app.route("/api/session/cleanup-nonpdf", methods=["POST"])
def api_session_cleanup_nonpdf():
    """out/work 配下の PDF 以外を削除する。"""
    result = _cleanup_non_pdf_in_session()
    return jsonify({"success": True, **result})


@app.route("/api/server/control", methods=["POST"])
def api_server_control():
    """開発サーバーを停止または再起動する。"""
    data = request.get_json() or {}
    if not isinstance(data, dict):
        return jsonify(
            {"success": False, "error": "payload must be a JSON object"}
        ), 400

    action = str(data.get("action") or "").strip().lower()
    if action not in {"stop", "restart"}:
        return (
            jsonify({"success": False, "error": "action must be 'stop' or 'restart'"}),
            400,
        )

    shutdown_func = request.environ.get("werkzeug.server.shutdown")
    if not callable(shutdown_func):
        return (
            jsonify(
                {
                    "success": False,
                    "error": "server control is unavailable in this runtime",
                }
            ),
            500,
        )

    if action == "restart":
        ok, message = _spawn_restart_process(delay_seconds=2)
        if not ok:
            logger.error("[server-control] restart schedule failed: %s", message)
            return jsonify({"success": False, "error": message}), 500
        threading.Thread(
            target=_delayed_shutdown,
            args=(shutdown_func, 0.3),
            daemon=True,
        ).start()
        logger.warning("[server-control] restart requested by %s", request.remote_addr)
        return jsonify({"success": True, "message": "serverを再起動します"})

    threading.Thread(
        target=_delayed_shutdown,
        args=(shutdown_func, 0.3),
        daemon=True,
    ).start()
    logger.warning("[server-control] stop requested by %s", request.remote_addr)
    return jsonify({"success": True, "message": "serverを停止します"})


@app.route("/static/<path:filename>")
def serve_static(filename):
    """静的ファイル配信"""
    if filename.lower().endswith(".html"):
        html_path = _resolve_safe_static_html_path(filename)
        if html_path is None:
            abort(404)
        return _serve_html_file_with_theme(html_path)
    return send_from_directory(STATIC_DIR, filename)


@app.route("/out/<path:filename>")
def serve_output(filename):
    """生成物（tex/pdf）の配信"""
    return send_from_directory(OUT_DIR, filename)


@app.route("/colors.html")
def serve_colors_html():
    return redirect("/static/docs/color/colors.html", code=301)


@app.route("/colors_200.html")
def serve_colors_200_html():
    return redirect("/static/docs/color/colors.html", code=301)


@app.route("/device-paper-size-map.html")
def serve_device_paper_size_map_html():
    return _serve_html_file_with_theme(
        DOCS_DIR / "device" / "device-paper-size-map.html"
    )


@app.route("/docs")
def serve_docs_index():
    return _serve_html_file_with_theme(DOCS_DIR / "index.html")


@app.route("/health")
def health():
    """ヘルスチェック"""
    return jsonify({"status": "ok", "time": datetime.now().isoformat()})


def create_app() -> Flask:
    _initialize_runtime_once()
    return app


def main() -> None:
    web_app = create_app()
    logger.info("Starting server (WORKDIR=%s)", WORKDIR)
    logger.info("DATA_DIR=%s", DATA_DIR)
    logger.info("OUT_DIR=%s", OUT_DIR)
    logger.info("Python=%s", _resolve_python_executable())
    logger.info("UI=http://127.0.0.1:5000")
    logger.info("Docs=http://127.0.0.1:5000/docs")
    debug = os.getenv("AOZORATEX_DEBUG", "1").strip().lower() in {"1", "true", "yes"}
    web_app.run(debug=debug, host="0.0.0.0", port=5000, use_reloader=False)


if __name__ == "__main__":
    main()
