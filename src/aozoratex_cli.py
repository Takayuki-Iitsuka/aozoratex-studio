from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from src import aozoratex
from src import settings_store


def run_cli() -> None:
    device_choices = sorted(
        set(settings_store.SUPPORTED_DEVICES)
        | set(settings_store.DEVICE_ALIASES.keys())
    )
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
        choices=device_choices,
        help="PDF output device: iphone | iphone_plus | android_phone | ipad | ipad_pro | android_tablet | pc (legacy aliases are accepted)",
        default="iphone",
    )
    parser.add_argument(
        "--device-orientation",
        choices=list(settings_store.SUPPORTED_ORIENTATIONS),
        help="device orientation: portrait | landscape (tablet profiles only)",
        default=None,
    )
    parser.add_argument(
        "--body-column-mode",
        choices=list(settings_store.SUPPORTED_BODY_COLUMN_MODES),
        help="body column mode: single_column | two_column",
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
        help="save current color/font settings into custom config files",
    )
    parser.add_argument(
        "--reset-settings",
        action="store_true",
        help="reset custom config files back to default values before generation",
    )
    parser.add_argument(
        "--use-default-settings",
        action="store_true",
        help="compile with *.default.ini only (ignore *.custom.ini for this run)",
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
        help="enable decorative Frame on body/final pages (pc/tablet profiles only)",
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
    parser.add_argument(
        "--background-render-mode",
        choices=list(settings_store.SUPPORTED_BACKGROUND_RENDER_MODES),
        default=None,
        help="background render mode: tikz | image",
    )
    parser.add_argument(
        "--cover-image",
        default=None,
        help="cover background image path under static/assets/backgrounds/cover or absolute path",
    )
    parser.add_argument(
        "--cover-image-opacity",
        type=float,
        default=None,
        help="cover background image opacity (0.0-1.0)",
    )
    parser.add_argument(
        "--washi-image",
        default=None,
        help="washi background image path under static/assets/backgrounds/washi or absolute path",
    )
    parser.add_argument(
        "--washi-image-opacity",
        type=float,
        default=None,
        help="washi background image opacity (0.0-1.0)",
    )
    parser.set_defaults(
        main_washi_enabled=None,
        main_frame_enabled=None,
        cover_texture_enabled=None,
    )
    args = parser.parse_args()

    normalized_device = settings_store.normalize_device_name(args.device)
    if args.device_orientation is None:
        args.device_orientation = settings_store.DEVICE_ORIENTATION_HINTS.get(args.device)

    if args.reset_settings:
        settings_store.reset_custom_settings()

    include_custom = not bool(args.use_default_settings)
    width, height = aozoratex.get_pdf_size(
        normalized_device,
        include_custom=include_custom,
    )
    if (
        args.device_orientation in settings_store.SUPPORTED_ORIENTATIONS
        and normalized_device in settings_store.DEVICE_ORIENTATION_OPTION_DEVICES
    ):
        if args.device_orientation == "landscape":
            width, height = height, width
    print(f"Generating PDF for {normalized_device} with size {width}x{height} mm")

    background_color, text_color = aozoratex.get_color_settings(
        include_custom=include_custom,
    )
    if args.bg_color:
        background_color = args.bg_color
    if args.fg_color:
        text_color = args.fg_color

    if args.save_settings and args.use_default_settings:
        print(
            "Warning: --use-default-settings 指定時は --save-settings を無視します。",
            file=sys.stderr,
        )

    if args.save_settings and not args.use_default_settings:
        aozoratex.save_current_settings(
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
        if args.background_render_mode is not None:
            decoration_updates["background_render_mode"] = args.background_render_mode
        if args.cover_image is not None:
            decoration_updates["cover_image_path"] = args.cover_image
        if args.cover_image_opacity is not None:
            decoration_updates["cover_image_opacity"] = str(args.cover_image_opacity)
        if args.washi_image is not None:
            decoration_updates["washi_image_path"] = args.washi_image
        if args.washi_image_opacity is not None:
            decoration_updates["washi_image_opacity"] = str(args.washi_image_opacity)
        if decoration_updates:
            settings_store.save_settings({"global": decoration_updates})

        device_updates: dict[str, Any] = {}
        if args.device_orientation is not None:
            device_updates["orientation"] = args.device_orientation
        if args.body_column_mode is not None:
            device_updates["mode"] = args.body_column_mode
        if device_updates:
            settings_store.save_settings({"devices": {normalized_device: device_updates}})

    src_path = Path(args.source)
    outdir = aozoratex.resolve_cli_work_outdir(args.out, normalized_device)
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
                device=normalized_device,
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
                background_render_mode=args.background_render_mode,
                cover_image_path=args.cover_image,
                cover_image_opacity=args.cover_image_opacity,
                washi_image_path=args.washi_image,
                washi_image_opacity=args.washi_image_opacity,
                body_column_mode=args.body_column_mode,
                device_orientation=args.device_orientation,
                use_default_settings=args.use_default_settings,
            )
            logger.info("write: %s", out_tex)
            success_count += 1
        except Exception as exc:
            logger.exception("failed: %s (%s)", in_path, exc)

    logger.info("done: %d/%d", success_count, len(inputs))
    if success_count == 0:
        sys.exit(1)


# `python -m src.aozoratex_cli` での直接実行に対応（README 記載の実行方法）
if __name__ == "__main__":
    run_cli()
