#!/usr/bin/env python3
"""
aozoratex Web Server

青空文庫HTMLから、デバイス・配色をカスタマイズしたLuaLaTeX PDFを生成するWebUI。

フロー:
  1. HTML選択 → 2. デバイス選択 → 3. 配色選択 → 4. プレビュー → 5. PDF/TEX生成
"""

from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    send_from_directory,
    redirect,
)
from pathlib import Path
import subprocess
import logging
import json
import shutil
import sys
from datetime import datetime
from typing import Optional

from src import settings_store

# ---- 設定 ----
WORKDIR = Path(__file__).resolve().parent.parent
app = Flask(
    __name__,
    template_folder=str(WORKDIR / "html_templates"),
    static_folder=None,
)
DATA_DIR = WORKDIR / "data"
OUT_DIR = WORKDIR / "out"
SESSION_DIR = OUT_DIR / "session"
SESSION_PDF_DIR = SESSION_DIR / "pdf"
SESSION_WORK_DIR = SESSION_DIR / "work"
STATIC_DIR = WORKDIR / "static"
DOCS_DIR = STATIC_DIR / "docs"
COLOR_PALETTE_FILE = STATIC_DIR / "color-palettes.json"
AOZORATEX_ENTRY = WORKDIR / "aozoratex.py"

settings_store.ensure_config_files()

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _safe_mkdir(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        logger.warning("Cannot create directory %s: %s", path, exc)


for _dir in (OUT_DIR, SESSION_DIR, SESSION_PDF_DIR, SESSION_WORK_DIR, STATIC_DIR):
    _safe_mkdir(_dir)


def _load_color_data() -> dict:
    """配色一覧ページと共通の配色JSONを読み込む。"""
    try:
        return json.loads(COLOR_PALETTE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.exception("Failed to load color palette JSON: %s", e)
        return {"palettes": {}, "categories": [], "preset_modes": {}}


def _luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0

    def adjust(v: float) -> float:
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    rr, gg, bb = adjust(r), adjust(g), adjust(b)
    return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb


def _contrast(c1: str, c2: str) -> float:
    l1 = _luminance(c1)
    l2 = _luminance(c2)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


def _build_color_schemes(mode: str) -> list[dict]:
    data = _load_color_data()
    palettes = data.get("palettes", {})
    categories = data.get("categories", [])
    preset_modes = data.get("preset_modes", {})

    # 例: sepia は固定プリセットを返す
    if mode in preset_modes:
        return list(preset_modes.get(mode, []))

    schemes: list[dict] = []
    for category in categories:
        cat_name = category.get("name", "Category")
        lights = palettes.get(category.get("lights", ""), [])
        darks = palettes.get(category.get("darks", ""), [])

        if mode in ("light", "all"):
            for bg in lights:
                for fg in darks:
                    if _contrast(bg["c"], fg["c"]) >= 4.5:
                        schemes.append(
                            {
                                "name": f"{bg['n']} × {fg['n']}",
                                "category": f"{cat_name} (Light Mode)",
                                "bg": bg["c"],
                                "fg": fg["c"],
                            }
                        )

        if mode in ("dark", "all"):
            for bg in darks:
                for fg in lights:
                    if _contrast(bg["c"], fg["c"]) >= 4.5:
                        schemes.append(
                            {
                                "name": f"{bg['n']} × {fg['n']}",
                                "category": f"{cat_name} (Dark Mode)",
                                "bg": bg["c"],
                                "fg": fg["c"],
                            }
                        )

    return schemes


def _to_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def _resolve_generation_defaults(
    device: Optional[str],
    mode: Optional[str],
    bg_color: Optional[str],
    fg_color: Optional[str],
) -> tuple[str, str, str, str]:
    normalized_device = str(device or settings_store.SUPPORTED_DEVICES[0]).lower()
    if normalized_device not in settings_store.SUPPORTED_DEVICES:
        normalized_device = settings_store.SUPPORTED_DEVICES[0]

    resolved_mode = settings_store.resolve_color_mode(normalized_device, mode)
    default_bg, default_fg = settings_store.get_mode_colors(resolved_mode)
    return (
        normalized_device,
        resolved_mode,
        str(bg_color or default_bg),
        str(fg_color or default_fg),
    )


def _save_generation_preferences(
    device: str,
    mode: str,
    bg_color: str,
    fg_color: str,
) -> None:
    settings_store.save_settings(
        {
            "global": {
                "color_mode": mode,
                "background_color": bg_color,
                "text_color": fg_color,
                f"background_color_{mode}": bg_color,
                f"text_color_{mode}": fg_color,
            },
            "devices": {device: {"color_mode": mode}},
        }
    )


def _resolve_python_executable() -> str:
    venv_python = WORKDIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def _decode_output(data: Optional[bytes]) -> str:
    if data is None:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("cp932", errors="replace")


def _move_ltjruby_sidecar(tex_file: Path, output_dir: Path) -> None:
    """
    luatexja が作る *.ltjruby がルートに出た場合、out 側へ移動する。
    """
    sidecar_name = tex_file.with_suffix(".ltjruby").name
    candidates = [
        WORKDIR / sidecar_name,
        tex_file.parent / sidecar_name,
    ]
    destination = output_dir / sidecar_name

    for src in candidates:
        if not src.exists():
            continue
        if src.resolve() == destination.resolve():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            destination.unlink()
        src.replace(destination)
        break


def _run_latexmk(tex_file: Path, output_dir: Path) -> tuple[bool, str]:
    """latexmk を実行して PDF を生成する。"""
    latexmk_bin = shutil.which("latexmk")
    if not latexmk_bin:
        return (
            False,
            "latexmk が見つかりません。TeX Live の PATH 設定を確認してください。",
        )

    cmd = [
        latexmk_bin,
        "-lualatex",
        "-interaction=nonstopmode",
        "-file-line-error",
        "-halt-on-error",
        "-silent",
        "-use-make",
        "-outdir=" + str(output_dir),
        str(tex_file),
    ]
    proc = subprocess.run(cmd, capture_output=True, timeout=180, cwd=WORKDIR)
    stdout_text = _decode_output(proc.stdout)
    stderr_text = _decode_output(proc.stderr)
    log_text = f"[latexmk] return_code={proc.returncode}\n{stdout_text}\n{stderr_text}"

    if proc.returncode != 0:
        return False, log_text

    _move_ltjruby_sidecar(tex_file, output_dir)
    return True, log_text


def _list_source_files() -> list[dict]:
    html_files = list(DATA_DIR.glob("*.html")) + list(DATA_DIR.glob("*.xhtml"))
    return [
        {"name": f.name, "path": str(f.relative_to(WORKDIR))}
        for f in sorted(html_files)
    ]


def _resolve_source_path(source: str) -> Optional[Path]:
    """source が data 配下の安全なファイルか検証して返す。"""
    source_path = (WORKDIR / source).resolve()
    data_dir = DATA_DIR.resolve()
    try:
        source_path.relative_to(data_dir)
    except ValueError:
        return None
    if not source_path.exists() or not source_path.is_file():
        return None
    return source_path


def _organize_session_outputs() -> dict:
    """
    out/session 直下のファイルを運用ルールに合わせて整理する。

    - *.pdf は out/session/pdf へ
    - それ以外は out/session/work へ
    """
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_PDF_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_WORK_DIR.mkdir(parents=True, exist_ok=True)

    moved_to_pdf = 0
    moved_to_work = 0

    for item in SESSION_DIR.iterdir():
        if not item.is_file():
            continue

        if item.suffix.lower() == ".pdf":
            target = SESSION_PDF_DIR / item.name
            moved_to_pdf += 1
        else:
            target = SESSION_WORK_DIR / item.name
            moved_to_work += 1

        if target.exists():
            target.unlink()
        item.replace(target)

    return {
        "moved_to_pdf": moved_to_pdf,
        "moved_to_work": moved_to_work,
    }


def _cleanup_non_pdf_in_session() -> dict:
    """out/session 配下の非PDFファイルを削除する。"""
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_PDF_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_WORK_DIR.mkdir(parents=True, exist_ok=True)

    deleted_files = 0
    for path in SESSION_DIR.rglob("*"):
        if path.is_file() and path.suffix.lower() != ".pdf":
            path.unlink()
            deleted_files += 1

    # 空ディレクトリを整理（固定運用ディレクトリは残す）
    protected_dirs = {
        SESSION_DIR.resolve(),
        SESSION_PDF_DIR.resolve(),
        SESSION_WORK_DIR.resolve(),
    }
    for d in sorted((p for p in SESSION_DIR.rglob("*") if p.is_dir()), reverse=True):
        if d.resolve() in protected_dirs:
            continue
        if not any(d.iterdir()):
            d.rmdir()

    return {"deleted_files": deleted_files}


def _generate_single(
    source: str,
    device: str,
    mode: str,
    bg_color: str,
    fg_color: str,
    compile_pdf: bool,
) -> tuple[bool, dict, int]:
    source_path = _resolve_source_path(source)
    if not source_path:
        return False, {"error": f"File not found or invalid path: {source}"}, 404

    SESSION_WORK_DIR.mkdir(parents=True, exist_ok=True)
    SESSION_PDF_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        _resolve_python_executable(),
        str(AOZORATEX_ENTRY),
        str(source_path),
        "--device",
        device,
        "--mode",
        mode,
        "--bg-color",
        bg_color,
        "--fg-color",
        fg_color,
        "--out",
        "out/session/work",
    ]

    logger.info("Running: %s", " ".join(cmd))
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=60)
    except subprocess.TimeoutExpired:
        return False, {"error": "aozoratex.py execution timeout"}, 500

    result_stdout = _decode_output(result.stdout)
    result_stderr = _decode_output(result.stderr)

    if result.returncode != 0:
        logger.error("aozoratex.py failed: %s", result_stderr)
        return (
            False,
            {
                "error": f"Conversion failed: {result_stderr}",
                "stdout": result_stdout,
                "stderr": result_stderr,
            },
            500,
        )

    out_tex = SESSION_WORK_DIR / f"{source_path.stem}.tex"
    out_pdf_in_work = SESSION_WORK_DIR / f"{source_path.stem}.pdf"
    out_pdf_final = SESSION_PDF_DIR / f"{source_path.stem}.pdf"

    compile_log = ""
    if compile_pdf:
        if not out_tex.exists():
            return False, {"error": f"Generated TEX not found: {out_tex.name}"}, 500

        compiled, compile_log = _run_latexmk(out_tex, SESSION_WORK_DIR)
        if not compiled:
            return (
                False,
                {
                    "error": "latexmk のコンパイルに失敗しました。",
                    "tex_file": str(out_tex.relative_to(WORKDIR)),
                    "compile_log": compile_log,
                },
                500,
            )

        if not out_pdf_in_work.exists():
            return (
                False,
                {
                    "error": "PDF は生成されましたが、出力ファイルが見つかりません。",
                    "tex_file": str(out_tex.relative_to(WORKDIR)),
                    "compile_log": compile_log,
                },
                500,
            )

        if out_pdf_final.exists():
            out_pdf_final.unlink()
        out_pdf_in_work.replace(out_pdf_final)

    pdf_file = ""
    pdf_url = ""
    if out_pdf_final.exists():
        pdf_file = str(out_pdf_final.relative_to(WORKDIR))
        pdf_url = f"/out/{out_pdf_final.relative_to(OUT_DIR).as_posix()}"

    return (
        True,
        {
            "source": source,
            "tex_file": str(out_tex.relative_to(WORKDIR)),
            "pdf_file": pdf_file,
            "pdf_url": pdf_url,
            "stdout": result_stdout,
            "stderr": result_stderr,
            "compile_log": compile_log,
        },
        200,
    )


# 起動時に既存の out/session を整理
try:
    _organize_session_outputs()
except PermissionError as exc:
    logger.warning("Skipping startup session organize due permission error: %s", exc)


# ---- ルート ----


@app.route("/")
def index():
    """メイン画面 - HTML/XHTML選択"""
    files_data = _list_source_files()
    return render_template("index.html", files=files_data)


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
            limit = max(1, int(limit_raw))
            schemes = schemes[:limit]
        except ValueError:
            pass

    return jsonify({"mode": mode, "schemes": schemes})


@app.route("/api/devices")
def api_devices():
    """デバイス設定 JSON API"""
    return jsonify(settings_store.get_device_api_payload())


@app.route("/api/settings", methods=["GET"])
def api_settings_get():
    return jsonify({"success": True, "settings": settings_store.export_settings_for_api()})


@app.route("/api/settings", methods=["POST"])
def api_settings_save():
    payload = request.get_json() or {}
    if not isinstance(payload, dict):
        return jsonify({"success": False, "error": "payload must be a JSON object"}), 400
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

    source = data.get("source")
    device, mode, bg_color, fg_color = _resolve_generation_defaults(
        data.get("device"),
        data.get("mode"),
        data.get("bg_color"),
        data.get("fg_color"),
    )
    compile_pdf = _to_bool(data.get("compile_pdf"), default=True)

    if not source:
        return jsonify({"success": False, "error": "source is required"}), 400

    _save_generation_preferences(device, mode, bg_color, fg_color)

    ok, payload, status = _generate_single(
        source=source,
        device=device,
        mode=mode,
        bg_color=bg_color,
        fg_color=fg_color,
        compile_pdf=compile_pdf,
    )
    payload["success"] = ok
    return jsonify(payload), status


@app.route("/api/generate-batch", methods=["POST"])
def api_generate_batch():
    """data 内の複数HTMLを選択または全件で PDF 生成する。"""
    data = request.get_json() or {}

    device, mode, bg_color, fg_color = _resolve_generation_defaults(
        data.get("device"),
        data.get("mode"),
        data.get("bg_color"),
        data.get("fg_color"),
    )
    compile_pdf = _to_bool(data.get("compile_pdf"), default=True)
    generate_all = _to_bool(data.get("generate_all"), default=False)

    sources = data.get("sources") or []
    if not isinstance(sources, list):
        return jsonify({"success": False, "error": "sources must be a list"}), 400

    if generate_all:
        sources = [entry["path"] for entry in _list_source_files()]

    if not sources:
        return jsonify({"success": False, "error": "sources is empty"}), 400

    _save_generation_preferences(device, mode, bg_color, fg_color)

    results: list[dict] = []
    failures: list[dict] = []

    for source in sources:
        ok, payload, _status = _generate_single(
            source=source,
            device=device,
            mode=mode,
            bg_color=bg_color,
            fg_color=fg_color,
            compile_pdf=compile_pdf,
        )
        payload["success"] = ok
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
    """out/session 直下を運用ルール（pdf/work）へ整理する。"""
    moved = _organize_session_outputs()
    return jsonify({"success": True, **moved})


@app.route("/api/session/cleanup-nonpdf", methods=["POST"])
def api_session_cleanup_nonpdf():
    """out/session 配下の PDF 以外を削除する。"""
    result = _cleanup_non_pdf_in_session()
    return jsonify({"success": True, **result})


@app.route("/static/<path:filename>")
def serve_static(filename):
    """静的ファイル配信"""
    return send_from_directory(STATIC_DIR, filename)


@app.route("/out/<path:filename>")
def serve_output(filename):
    """生成物（tex/pdf）の配信"""
    return send_from_directory(OUT_DIR, filename)


@app.route("/colors.html")
def serve_colors_html():
    return send_from_directory(DOCS_DIR / "color", "colors.html")


@app.route("/colors_200.html")
def serve_colors_200_html():
    return redirect("/colors.html", code=301)


@app.route("/device-paper-size-map.html")
def serve_device_paper_size_map_html():
    return send_from_directory(DOCS_DIR / "device", "device-paper-size-map.html")


@app.route("/docs")
def serve_docs_index():
    return send_from_directory(DOCS_DIR, "index.html")


@app.route("/health")
def health():
    """ヘルスチェック"""
    return jsonify({"status": "ok", "time": datetime.now().isoformat()})


def main() -> None:
    logger.info(f"Starting server (WORKDIR={WORKDIR})")
    logger.info(f"DATA_DIR={DATA_DIR}")
    logger.info(f"OUT_DIR={OUT_DIR}")
    app.run(debug=True, host="0.0.0.0", port=5000)


if __name__ == "__main__":
    main()
