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

def cmd_cleanup_nonpdf(args):
    result = server_services.cleanup_non_pdf_in_session()
    print(json.dumps({"success": True, **result}), flush=True)

def cmd_session_organize(args):
    result = server_services.organize_session_outputs()
    print(json.dumps({"success": True, **result}), flush=True)

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

    # session-cleanup
    subparsers.add_parser("session-cleanup")

    # session-organize
    subparsers.add_parser("session-organize")

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
        "session-cleanup": cmd_cleanup_nonpdf,
        "session-organize": cmd_session_organize,
        "generate": cmd_generate,
    }

    commands[args.command](args)

if __name__ == "__main__":
    main()

