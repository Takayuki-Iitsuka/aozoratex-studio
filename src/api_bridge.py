#!/usr/bin/env python3
"""
api_bridge.py

A bridge script to expose Python business logic, configuration, 
and compilation services to the Node.js/Bun backend.
"""

import sys
import json
import argparse
from pathlib import Path
from typing import Optional

# Set up project path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src import settings_store
from src import server_services

def cmd_files(args):
    files = server_services.list_source_files()
    print(json.dumps({"success": True, "files": files}), flush=True)

def cmd_background_assets(args):
    assets = server_services.list_background_assets()
    print(json.dumps({"success": True, **assets}), flush=True)

def cmd_colors(args):
    mode = args.mode or "light"
    schemes = server_services.build_color_schemes(mode)
    limit = args.limit or server_services.MAX_COLOR_SCHEMES
    schemes = server_services.limit_color_schemes_balanced(schemes, limit)
    print(json.dumps({"success": True, "mode": mode, "schemes": schemes}), flush=True)

def cmd_fonts(args):
    refresh = args.refresh
    fonts, meta = server_services.load_lualatex_fonts(refresh)
    print(json.dumps({"success": True, "fonts": fonts, **meta}), flush=True)

def cmd_devices(args):
    payload = settings_store.get_device_api_payload()
    print(json.dumps(payload), flush=True)

def cmd_settings_get(args):
    payload = settings_store.export_settings_for_api()
    print(json.dumps({"success": True, "settings": payload}), flush=True)

def cmd_settings_save(args):
    try:
        data = json.loads(args.data)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON payload: {e}"}), flush=True)
        sys.exit(1)
    
    updated = settings_store.save_settings(data)
    print(json.dumps({"success": True, "settings": updated}), flush=True)

def cmd_settings_reset(args):
    updated = settings_store.reset_custom_settings()
    print(json.dumps({"success": True, "settings": updated}), flush=True)

def cmd_device_defaults_get(args):
    devices = settings_store.get_device_default_settings()
    config_file = settings_store.get_device_default_file_info()
    print(
        json.dumps({"success": True, "devices": devices, "config_file": config_file}),
        flush=True,
    )

def cmd_device_defaults_save(args):
    try:
        data = json.loads(args.data)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON payload: {e}"}), flush=True)
        sys.exit(1)

    devices = settings_store.save_device_default_settings(data)
    print(json.dumps({"success": True, "devices": devices}), flush=True)

def cmd_device_defaults_reset(args):
    devices = settings_store.reset_device_default_settings()
    print(json.dumps({"success": True, "devices": devices}), flush=True)

def cmd_device_defaults_open(args):
    ok, payload = server_services.open_device_default_file(args.app)
    print(json.dumps({"success": ok, **payload}), flush=True)

def cmd_cleanup_nonpdf(args):
    result = server_services.cleanup_non_pdf_in_session()
    print(json.dumps({"success": True, **result}), flush=True)

def cmd_session_organize(args):
    result = server_services.organize_session_outputs()
    print(json.dumps({"success": True, **result}), flush=True)

def cmd_library_status(args):
    status = server_services.get_library_status()
    print(json.dumps({"success": True, **status}), flush=True)

def cmd_library_update_index(args):
    # 失敗しても exit 0 で JSON を返す（Node 側は非 0 終了時に stdout を捨てるため）
    ok, payload = server_services.update_library_index()
    print(json.dumps({"success": ok, **payload}), flush=True)

def cmd_library_search(args):
    ok, payload = server_services.search_library(
        query=args.query,
        offset=args.offset,
        limit=args.limit,
    )
    print(json.dumps({"success": ok, **payload}), flush=True)

def cmd_library_download(args):
    book_ids = [part.strip() for part in (args.book_ids or "").split(",") if part.strip()]

    def emit_log(line: str):
        print(f"LOG:{line}", flush=True)

    ok, payload = server_services.download_library_books(
        book_ids=book_ids,
        overwrite=args.overwrite,
        sleep_sec=args.sleep,
        emit_log=emit_log,
    )
    payload["success"] = ok

    # generate と同じく最終結果を "RESULT:" プレフィクスで出力
    print(f"RESULT:{json.dumps(payload)}", flush=True)
    if not ok:
        sys.exit(1)

def cmd_generate(args):
    source = args.source
    device = args.device
    bg_color = args.bg_color
    fg_color = args.fg_color
    font_family = args.font_family
    compile_pdf = args.compile_pdf != "false"
    
    decorations = {}
    if args.decorations_json:
        try:
            decorations = json.loads(args.decorations_json)
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Invalid decorations JSON: {e}"}), flush=True)
            sys.exit(1)
            
    def emit_log(line: str):
        # We print logs prefixing with "LOG:" so the backend can easily distinguish
        # compilation progress lines from the final JSON result block.
        print(f"LOG:{line}", flush=True)

    ok, payload, status = server_services.generate_single(
        source=source,
        device=device,
        bg_color=bg_color,
        fg_color=fg_color,
        font_family=font_family,
        compile_pdf=compile_pdf,
        decorations=decorations,
        emit_log=emit_log
    )
    payload["success"] = ok
    
    # Print the final result prefixing with "RESULT:"
    print(f"RESULT:{json.dumps(payload)}", flush=True)
    if not ok:
        sys.exit(1)

def main():
    # Node 側は stdout を UTF-8 でデコードするため、Windows のパイプ既定
    # エンコーディング (cp932) に依存しないよう UTF-8 に固定する
    if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="AozoraTeX Studio API Bridge")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # files
    subparsers.add_parser("files")

    # background-assets
    subparsers.add_parser("background-assets")

    # colors
    parser_colors = subparsers.add_parser("colors")
    parser_colors.add_argument("--mode", default="light")
    parser_colors.add_argument("--limit", type=int, default=0)

    # fonts
    parser_fonts = subparsers.add_parser("fonts")
    parser_fonts.add_argument("--refresh", action="store_true")

    # devices
    subparsers.add_parser("devices")

    # settings-get
    subparsers.add_parser("settings-get")

    # settings-save
    parser_save = subparsers.add_parser("settings-save")
    parser_save.add_argument("--data", required=True)

    # settings-reset
    subparsers.add_parser("settings-reset")

    # device-defaults-get
    subparsers.add_parser("device-defaults-get")

    # device-defaults-save
    parser_device_defaults_save = subparsers.add_parser("device-defaults-save")
    parser_device_defaults_save.add_argument("--data", required=True)

    # device-defaults-reset
    subparsers.add_parser("device-defaults-reset")

    # device-defaults-open（初期値ファイルを外部エディタで開く）
    parser_device_defaults_open = subparsers.add_parser("device-defaults-open")
    parser_device_defaults_open.add_argument(
        "--app",
        default="default",
        choices=list(server_services.SUPPORTED_CONFIG_EDITORS),
    )

    # session-cleanup
    subparsers.add_parser("session-cleanup")

    # session-organize
    subparsers.add_parser("session-organize")

    # library-status
    subparsers.add_parser("library-status")

    # library-update-index
    subparsers.add_parser("library-update-index")

    # library-search
    parser_lib_search = subparsers.add_parser("library-search")
    parser_lib_search.add_argument("--query", default="")
    parser_lib_search.add_argument("--offset", type=int, default=0)
    parser_lib_search.add_argument("--limit", type=int, default=50)

    # library-download
    parser_lib_dl = subparsers.add_parser("library-download")
    parser_lib_dl.add_argument("--book-ids", required=True)
    parser_lib_dl.add_argument("--overwrite", action="store_true")
    parser_lib_dl.add_argument(
        "--sleep", type=float, default=server_services.LIBRARY_DOWNLOAD_SLEEP_SEC
    )

    # generate
    parser_gen = subparsers.add_parser("generate")
    parser_gen.add_argument("--source", required=True)
    parser_gen.add_argument("--device", required=True)
    parser_gen.add_argument("--bg-color", required=True)
    parser_gen.add_argument("--fg-color", required=True)
    parser_gen.add_argument("--font-family", default=None)
    parser_gen.add_argument("--compile-pdf", default="true")
    parser_gen.add_argument("--decorations-json", default=None)

    args = parser.parse_args()

    # Dispatch commands
    commands = {
        "files": cmd_files,
        "background-assets": cmd_background_assets,
        "colors": cmd_colors,
        "fonts": cmd_fonts,
        "devices": cmd_devices,
        "settings-get": cmd_settings_get,
        "settings-save": cmd_settings_save,
        "settings-reset": cmd_settings_reset,
        "device-defaults-get": cmd_device_defaults_get,
        "device-defaults-save": cmd_device_defaults_save,
        "device-defaults-reset": cmd_device_defaults_reset,
        "device-defaults-open": cmd_device_defaults_open,
        "session-cleanup": cmd_cleanup_nonpdf,
        "session-organize": cmd_session_organize,
        "library-status": cmd_library_status,
        "library-update-index": cmd_library_update_index,
        "library-search": cmd_library_search,
        "library-download": cmd_library_download,
        "generate": cmd_generate,
    }

    commands[args.command](args)

if __name__ == "__main__":
    main()

