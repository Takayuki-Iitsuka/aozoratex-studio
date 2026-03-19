from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from src import aozoratex
from src import settings_store


def run_cli() -> None:
    parser = argparse.ArgumentParser(
        description="Aozora HTML/XHTML -> LuaLaTeX .tex generator (local files only)"
    )
    parser.add_argument("source", help="local HTML file path OR directory (data/)")
    parser.add_argument(
        "--out", help="output base directory (default: ./out)", default="out"
    )
    parser.add_argument(
        "--font",
        help="Main Japanese font name (overrides global settings)",
        default=None,
    )
    parser.add_argument(
        "--encoding",
        help="preferred input encoding (auto detects if omitted)",
        default=None,
    )
    parser.add_argument(
        "--parser",
        help="BeautifulSoup features: lxml|html.parser|lxml-xml (default: html.parser)",
        default="html.parser",
    )
    parser.add_argument("--verbose", action="store_true", help="verbose console log")
    parser.add_argument(
        "--device",
        choices=[
            "iphone",
            "android",
            "ipad",
            "ipad_landscape",
            "pc",
        ],
        help="PDF output device: iphone | android | ipad | ipad_landscape | pc",
        default="iphone",
    )
    parser.add_argument(
        "--mode",
        choices=["light", "dark", "intermediate"],
        help="PDF color mode: light, dark, or intermediate (overrides config)",
        default=None,
    )
    parser.add_argument(
        "--bg-color",
        help="override background color (example: #FDF6E3)",
        default=None,
    )
    parser.add_argument(
        "--fg-color",
        help="override text color (example: #657B83)",
        default=None,
    )
    parser.add_argument(
        "--save-settings",
        action="store_true",
        help="save current mode/color/font settings into custom config files",
    )
    parser.add_argument(
        "--reset-settings",
        action="store_true",
        help="reset custom config files back to default values before generation",
    )
    parser.add_argument(
        "--main-washi",
        dest="main_washi_enabled",
        action="store_true",
        help="enable washi background on all pages (cover to colophon)",
    )
    parser.add_argument(
        "--no-main-washi",
        dest="main_washi_enabled",
        action="store_false",
        help="disable washi background on all pages (cover to colophon)",
    )
    parser.add_argument(
        "--main-frame",
        dest="main_frame_enabled",
        action="store_true",
        help="enable decorative Frame on body/final pages (pc/ipad only)",
    )
    parser.add_argument(
        "--no-main-frame",
        dest="main_frame_enabled",
        action="store_false",
        help="disable decorative Frame on body/final pages",
    )
    parser.add_argument(
        "--main-frame-variant",
        type=int,
        choices=[1, 2, 3],
        default=None,
        help="main frame template variant (1-3)",
    )
    parser.add_argument(
        "--cover-texture",
        dest="cover_texture_enabled",
        action="store_true",
        help="enable texture on cover page",
    )
    parser.add_argument(
        "--no-cover-texture",
        dest="cover_texture_enabled",
        action="store_false",
        help="disable texture on cover page",
    )
    parser.add_argument(
        "--cover-texture-variant",
        type=int,
        choices=[1, 2, 3],
        default=None,
        help="cover texture template variant (1-3)",
    )
    parser.set_defaults(
        main_washi_enabled=None,
        main_frame_enabled=None,
        cover_texture_enabled=None,
    )
    args = parser.parse_args()

    if args.reset_settings:
        settings_store.reset_custom_settings()

    mode = aozoratex.resolve_color_mode(args.device, args.mode)

    width, height = aozoratex.get_pdf_size(args.device)
    print(f"Generating PDF for {args.device} with size {width}x{height} mm")

    background_color, text_color = aozoratex.get_color_settings(mode)
    if args.bg_color:
        background_color = args.bg_color
    if args.fg_color:
        text_color = args.fg_color

    if args.save_settings:
        aozoratex.save_current_settings(
            device=args.device,
            mode=mode,
            background_color=background_color,
            text_color=text_color,
            font_override=args.font,
        )

        decoration_updates: dict[str, Any] = {}
        if args.main_washi_enabled is not None:
            decoration_updates["main_washi_enabled"] = (
                "true" if bool(args.main_washi_enabled) else "false"
            )
        if args.main_frame_enabled is not None:
            decoration_updates["main_frame_enabled"] = (
                "true" if bool(args.main_frame_enabled) else "false"
            )
        if args.main_frame_variant is not None:
            decoration_updates["main_frame_variant"] = str(args.main_frame_variant)
        if args.cover_texture_enabled is not None:
            decoration_updates["cover_texture_enabled"] = (
                "true" if bool(args.cover_texture_enabled) else "false"
            )
        if args.cover_texture_variant is not None:
            decoration_updates["cover_texture_variant"] = str(
                args.cover_texture_variant
            )
        if decoration_updates:
            settings_store.save_settings({"global": decoration_updates})

    src_path = Path(args.source)
    outdir = aozoratex.resolve_cli_work_outdir(args.out, args.device)
    outdir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = outdir / f"aozoratex_{timestamp}.log"
    logger = aozoratex.setup_logger(log_path, verbose=args.verbose)

    if not src_path.exists():
        logger.error("not found: %s", src_path)
        sys.exit(2)

    inputs: list[Path] = []
    if src_path.is_dir():
        inputs.extend(sorted(p for p in src_path.glob("*.html") if p.is_file()))
        inputs.extend(sorted(p for p in src_path.glob("*.xhtml") if p.is_file()))
    else:
        inputs.append(src_path)

    if not inputs:
        logger.error("no input html/xhtml found: %s", src_path)
        sys.exit(2)

    logger.info("inputs: %d", len(inputs))
    logger.info("output dir: %s", outdir)
    logger.info("log: %s", log_path)

    success_count = 0
    for in_path in inputs:
        try:
            html, enc_used = aozoratex.fetch_html_local(
                str(in_path), preferred_encoding=args.encoding
            )
            logger.info("read: %s (encoding=%s)", in_path, enc_used)

            body = aozoratex.html_to_latex_body(html, parser=args.parser)
            raw_title, raw_author = aozoratex.extract_title_author_raw(
                html, parser=args.parser
            )
            title = aozoratex.escape_latex(raw_title)
            author = aozoratex.escape_latex(raw_author)
            okuduke = aozoratex.build_okuduke_from_html(html, parser=args.parser)

            output_stem = aozoratex.build_output_stem(in_path, raw_title, raw_author)
            out_tex = outdir / f"{output_stem}.tex"
            aozoratex.build_tex_file(
                latex_body=body,
                out_tex=out_tex,
                device=args.device,
                font_override=args.font,
                background_color=background_color,
                text_color=text_color,
                title=title,
                author=author,
                okuduke_override=okuduke,
                html_path=in_path,
                main_washi_enabled=args.main_washi_enabled,
                main_frame_enabled=args.main_frame_enabled,
                main_frame_variant=args.main_frame_variant,
                cover_texture_enabled=args.cover_texture_enabled,
                cover_texture_variant=args.cover_texture_variant,
            )
            logger.info("write: %s", out_tex)
            success_count += 1
        except Exception as exc:
            logger.exception("failed: %s (%s)", in_path, exc)

    logger.info("done: %d/%d", success_count, len(inputs))
    if success_count == 0:
        sys.exit(1)
