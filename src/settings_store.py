from __future__ import annotations

"""
Configuration store for AozoraTeX Studio.

Responsibilities:
- Keep defaults and custom overrides in `config/*.ini`
- Load and merge settings safely for API / CLI
- Provide device labels, supported modes, and export payload for frontend

リファクタ済み: 正規化ロジックを一部集約。
"""

import configparser
import re
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"

GLOBAL_DEFAULT_FILE = CONFIG_DIR / "global_settings.default.ini"
GLOBAL_CUSTOM_FILE = CONFIG_DIR / "global_settings.custom.ini"
DEVICE_DEFAULT_FILE = CONFIG_DIR / "device_settings.default.ini"
DEVICE_CUSTOM_FILE = CONFIG_DIR / "device_settings.custom.ini"

SUPPORTED_BODY_COLUMN_MODES = ("single_column", "two_column")
SUPPORTED_ORIENTATIONS = ("portrait", "landscape")
SUPPORTED_DEVICES = (
    "iphone",
    "iphone_plus",
    "android_phone",
    "ipad",
    "ipad_pro",
    "android_tablet",
    "pc",
)
SUPPORTED_BACKGROUND_RENDER_MODES = ("tikz", "image")
DEVICE_ALIASES: dict[str, str] = {
    "smart": "iphone",
    "phone": "iphone",
    "android": "android_phone",
    "tablet": "ipad",
    "ipad_landscape": "ipad",
    "android_tab": "android_tablet",
}
DEVICE_ORIENTATION_HINTS: dict[str, str] = {
    "iphone": "portrait",
    "iphone_plus": "portrait",
    "android": "portrait",
    "android_phone": "portrait",
    "ipad": "portrait",
    "ipad_landscape": "landscape",
    "ipad_pro": "portrait",
    "android_tablet": "portrait",
}
SMARTPHONE_DEVICES = {"iphone", "iphone_plus", "android_phone"}
TABLET_DEVICES = {"ipad", "ipad_pro", "android_tablet"}
DEVICE_ORIENTATION_OPTION_DEVICES = set(TABLET_DEVICES) | {"pc"}
DEVICE_COLUMN_OPTION_DEVICES = set(TABLET_DEVICES) | {"pc"}

DEVICE_LABELS: dict[str, str] = {
    "iphone": "iPhone 標準（90.0x195.0mm）",
    "iphone_plus": "iPhone Plus / Pro Max（96.0x208.0mm）",
    "android_phone": "Android 主流スマホ（90.0x200.0mm）",
    "ipad": "iPad 標準（150.0x215.0mm）",
    "ipad_pro": "iPad Pro（150.0x200.0mm）",
    "android_tablet": "Android 主流タブレット（150.0x240.0mm）",
    "pc": "PC（A4版用紙） (210.0x297.0mm)",
}

DEVICE_CATEGORIES: dict[str, str] = {
    "iphone": "smartphone",
    "iphone_plus": "smartphone",
    "android_phone": "smartphone",
    "ipad": "tablet",
    "ipad_pro": "tablet",
    "android_tablet": "tablet",
    "pc": "pc",
}

GLOBAL_DEFAULTS: dict[str, str] = {
    "selected_device": "iphone",
    "font_family": "IPAmjMincho",
    "body_column_mode": "single_column",
    "main_washi_enabled": "false",
    "main_frame_enabled": "false",
    "main_frame_variant": "1",
    "cover_texture_enabled": "true",
    "cover_texture_variant": "1",
    "background_render_mode": "tikz",
    "cover_image_path": "",
    "cover_image_opacity": "0.92",
    "washi_image_path": "",
    "washi_image_opacity": "0.18",
    "page_number_enabled": "true",
    "background_color": "#FFFFFF",
    "text_color": "#000000",
}

DEVICE_DEFAULTS: dict[str, dict[str, Any]] = {
    "iphone": {
        "font_size": 9.0,
        "width_mm": 90.0,
        "height_mm": 195.0,
        "margin_top_mm": 3.0,
        "margin_bottom_mm": 3.0,
        "margin_left_mm": 3.0,
        "margin_right_mm": 3.0,
        "mode": "single_column",
        "show_page_number": False,
        "orientation": "portrait",
        "line_gap_ratio": 0.35,
        "line_leading_ratio": 1.35,
        "character_spacing_zw": 0.0,
    },
    "iphone_plus": {
        "font_size": 9.0,
        "width_mm": 96.0,
        "height_mm": 208.0,
        "margin_top_mm": 3.0,
        "margin_bottom_mm": 3.0,
        "margin_left_mm": 3.0,
        "margin_right_mm": 3.0,
        "mode": "single_column",
        "show_page_number": False,
        "orientation": "portrait",
        "line_gap_ratio": 0.35,
        "line_leading_ratio": 1.35,
        "character_spacing_zw": 0.0,
    },
    "android_phone": {
        "font_size": 9.0,
        "width_mm": 90.0,
        "height_mm": 200.0,
        "margin_top_mm": 3.0,
        "margin_bottom_mm": 3.0,
        "margin_left_mm": 3.0,
        "margin_right_mm": 3.0,
        "mode": "single_column",
        "show_page_number": False,
        "orientation": "portrait",
        "line_gap_ratio": 0.35,
        "line_leading_ratio": 1.35,
        "character_spacing_zw": 0.0,
    },
    "ipad": {
        "font_size": 11.0,
        "width_mm": 150.0,
        "height_mm": 215.0,
        "margin_top_mm": 5.0,
        "margin_bottom_mm": 5.0,
        "margin_left_mm": 5.0,
        "margin_right_mm": 5.0,
        "mode": "single_column",
        "show_page_number": True,
        "orientation": "portrait",
        "line_gap_ratio": 0.25,
        "line_leading_ratio": 1.25,
        "character_spacing_zw": 0.0,
    },
    "ipad_pro": {
        "font_size": 11.0,
        "width_mm": 150.0,
        "height_mm": 200.0,
        "margin_top_mm": 5.0,
        "margin_bottom_mm": 5.0,
        "margin_left_mm": 5.0,
        "margin_right_mm": 5.0,
        "mode": "single_column",
        "show_page_number": True,
        "orientation": "portrait",
        "line_gap_ratio": 0.25,
        "line_leading_ratio": 1.25,
        "character_spacing_zw": 0.0,
    },
    "android_tablet": {
        "font_size": 11.0,
        "width_mm": 150.0,
        "height_mm": 240.0,
        "margin_top_mm": 5.0,
        "margin_bottom_mm": 5.0,
        "margin_left_mm": 5.0,
        "margin_right_mm": 5.0,
        "mode": "single_column",
        "show_page_number": True,
        "orientation": "portrait",
        "line_gap_ratio": 0.25,
        "line_leading_ratio": 1.25,
        "character_spacing_zw": 0.0,
    },
    "pc": {
        "font_size": 13.5,
        "width_mm": 210.0,
        "height_mm": 297.0,
        "margin_top_mm": 20.0,
        "margin_bottom_mm": 20.0,
        "margin_left_mm": 20.0,
        "margin_right_mm": 20.0,
        "mode": "single_column",
        "show_page_number": True,
        "orientation": "portrait",
        "line_gap_ratio": 0.5,
        "line_leading_ratio": 1.5,
        "character_spacing_zw": 0.0,
    },
}

GLOBAL_ALLOWED_KEYS = set(GLOBAL_DEFAULTS.keys())
DEVICE_ALLOWED_KEYS = {
    "font_size",
    "width_mm",
    "height_mm",
    "margin_top_mm",
    "margin_bottom_mm",
    "margin_left_mm",
    "margin_right_mm",
    "mode",
    "show_page_number",
    "orientation",
    "line_gap_ratio",
    "line_leading_ratio",
    "character_spacing_zw",
}


def _new_parser() -> configparser.ConfigParser:
    cfg = configparser.ConfigParser(inline_comment_prefixes=(";",))
    return cfg


def _strip_inline_comment(value: str) -> str:
    return re.sub(r"\s+#.*$", "", value).strip()


def _normalize_orientation(value: str | None, fallback: str = "portrait") -> str:
    orientation = (value or "").strip().lower()
    if orientation in SUPPORTED_ORIENTATIONS:
        return orientation
    return fallback


def _normalize_device_name(device: str | None) -> str:
    raw = (device or "iphone").strip().lower()
    normalized_device = DEVICE_ALIASES.get(raw, raw)
    if normalized_device not in SUPPORTED_DEVICES:
        return "iphone"
    return normalized_device


def normalize_device_name(device: str | None) -> str:
    return _normalize_device_name(device)


def _resolve_device_orientation_hint(device: str | None) -> str | None:
    raw = (device or "").strip().lower()
    hint = DEVICE_ORIENTATION_HINTS.get(raw)
    if hint in SUPPORTED_ORIENTATIONS:
        return hint
    return None


def _normalize_hex(value: str, fallback: str) -> str:
    raw = _strip_inline_comment(value).strip()
    if not raw:
        return fallback
    if not raw.startswith("#"):
        raw = "#" + raw
    if re.fullmatch(r"#[0-9A-Fa-f]{6}", raw):
        return raw.upper()
    return fallback


def _safe_int(raw: str, fallback: int) -> int:
    try:
        return int(float(_strip_inline_comment(raw)))
    except ValueError:
        return fallback


def _safe_float(raw: str, fallback: float) -> float:
    s = _strip_inline_comment(raw).lower().replace("mm", "").replace("pt", "").strip()
    try:
        return float(s)
    except ValueError:
        return fallback


def _safe_bool(raw: str, fallback: bool) -> bool:
    s = _strip_inline_comment(raw).strip().lower()
    if s in {"1", "true", "yes", "on"}:
        return True
    if s in {"0", "false", "no", "off"}:
        return False
    return fallback


def _write_parser(path: Path, parser: configparser.ConfigParser) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        parser.write(fh)


def _render_global_default_ini() -> str:
    lines = [
        "[global]",
        f"selected_device = {GLOBAL_DEFAULTS['selected_device']}",
        f"font_family = {GLOBAL_DEFAULTS['font_family']}",
        f"body_column_mode = {GLOBAL_DEFAULTS['body_column_mode']}",
        f"main_washi_enabled = {GLOBAL_DEFAULTS['main_washi_enabled']}",
        f"main_frame_enabled = {GLOBAL_DEFAULTS['main_frame_enabled']}",
        f"main_frame_variant = {GLOBAL_DEFAULTS['main_frame_variant']}",
        f"cover_texture_enabled = {GLOBAL_DEFAULTS['cover_texture_enabled']}",
        f"cover_texture_variant = {GLOBAL_DEFAULTS['cover_texture_variant']}",
        f"background_render_mode = {GLOBAL_DEFAULTS['background_render_mode']}",
        f"cover_image_path = {GLOBAL_DEFAULTS['cover_image_path']}",
        f"cover_image_opacity = {GLOBAL_DEFAULTS['cover_image_opacity']}",
        f"washi_image_path = {GLOBAL_DEFAULTS['washi_image_path']}",
        f"washi_image_opacity = {GLOBAL_DEFAULTS['washi_image_opacity']}",
        f"page_number_enabled = {GLOBAL_DEFAULTS['page_number_enabled']}",
        f"background_color = {GLOBAL_DEFAULTS['background_color']}",
        f"text_color = {GLOBAL_DEFAULTS['text_color']}",
        "",
    ]
    return "\n".join(lines)


def _render_device_default_ini(
    profiles: dict[str, dict[str, Any]] | None = None,
) -> str:
    """デバイス初期値の ini テキストを生成する。

    profiles 省略時は工場出荷値（DEVICE_DEFAULTS）を使う。
    profiles を渡すとその値で全端末分を書き出す（初期値編集の保存用）。
    """
    source = profiles or DEVICE_DEFAULTS
    lines: list[str] = [
        "[meta]",
        "; フォント名の初期値は global_settings.default.ini の font_family で一元管理します。",
        "; このファイルはデバイスごとの本文サイズ（font_size）とレイアウト値のみを管理します。",
        "; 1行あたりの文字数目安は font_size と余白から自動計算されます。",
        "",
    ]
    for device in SUPPORTED_DEVICES:
        profile = source.get(device, DEVICE_DEFAULTS[device])
        lines.append(f"[{device}]")
        lines.append(f"font_size = {profile['font_size']}")
        lines.append(f"width_mm = {profile['width_mm']}")
        lines.append(f"height_mm = {profile['height_mm']}")
        lines.append(f"margin_top_mm = {profile['margin_top_mm']}")
        lines.append(f"margin_bottom_mm = {profile['margin_bottom_mm']}")
        lines.append(f"margin_left_mm = {profile['margin_left_mm']}")
        lines.append(f"margin_right_mm = {profile['margin_right_mm']}")
        lines.append(f"mode = {profile['mode']}")
        lines.append(
            "show_page_number = "
            + ("true" if bool(profile["show_page_number"]) else "false")
        )
        lines.append(f"orientation = {profile.get('orientation', 'portrait')}")
        lines.append(f"line_gap_ratio = {profile.get('line_gap_ratio', 0.5)}")
        lines.append(
            f"line_leading_ratio = {profile.get('line_leading_ratio', 1.5)}"
        )
        lines.append(
            f"character_spacing_zw = {profile.get('character_spacing_zw', 0.0)}"
        )
        lines.append("")
    return "\n".join(lines)


def _prune_custom_settings_files() -> None:
    """
    custom ini から未対応キーを除去して設定面の一貫性を保つ。

    - global: GLOBAL_ALLOWED_KEYS に無いキーを削除
    - device: SUPPORTED_DEVICES 以外のセクション、DEVICE_ALLOWED_KEYS 以外のキーを削除
    """
    global_parser = _new_parser()
    global_parser.read(GLOBAL_CUSTOM_FILE, encoding="utf-8")
    global_changed = False

    for section in list(global_parser.sections()):
        if section != "global":
            global_parser.remove_section(section)
            global_changed = True
            continue
        for key in list(global_parser[section].keys()):
            if key not in GLOBAL_ALLOWED_KEYS:
                global_parser.remove_option(section, key)
                global_changed = True

    if global_changed:
        _write_parser(GLOBAL_CUSTOM_FILE, global_parser)

    device_parser = _new_parser()
    device_parser.read(DEVICE_CUSTOM_FILE, encoding="utf-8")
    device_changed = False

    for section in list(device_parser.sections()):
        normalized_section = _normalize_device_name(section)
        if section not in SUPPORTED_DEVICES and normalized_section in SUPPORTED_DEVICES:
            if not device_parser.has_section(normalized_section):
                device_parser.add_section(normalized_section)
            for key, value in list(device_parser[section].items()):
                if key in DEVICE_ALLOWED_KEYS and not device_parser.has_option(
                    normalized_section,
                    key,
                ):
                    device_parser.set(normalized_section, key, value)
            device_parser.remove_section(section)
            device_changed = True
            continue
        if section not in SUPPORTED_DEVICES:
            device_parser.remove_section(section)
            device_changed = True
            continue
        for key in list(device_parser[section].keys()):
            if key not in DEVICE_ALLOWED_KEYS:
                device_parser.remove_option(section, key)
                device_changed = True

    if device_changed:
        _write_parser(DEVICE_CUSTOM_FILE, device_parser)


def ensure_config_files() -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    if not GLOBAL_DEFAULT_FILE.exists():
        GLOBAL_DEFAULT_FILE.write_text(_render_global_default_ini(), encoding="utf-8")
    if not DEVICE_DEFAULT_FILE.exists():
        DEVICE_DEFAULT_FILE.write_text(_render_device_default_ini(), encoding="utf-8")
    if not GLOBAL_CUSTOM_FILE.exists():
        GLOBAL_CUSTOM_FILE.write_text("", encoding="utf-8")
    if not DEVICE_CUSTOM_FILE.exists():
        DEVICE_CUSTOM_FILE.write_text("", encoding="utf-8")

    _prune_custom_settings_files()


def _load_merged(
    default_file: Path,
    custom_file: Path,
    *,
    include_custom: bool = True,
) -> configparser.ConfigParser:
    ensure_config_files()
    cfg = _new_parser()
    cfg.read(default_file, encoding="utf-8")
    if include_custom:
        cfg.read(custom_file, encoding="utf-8")
    return cfg


def _get_option(
    cfg: configparser.ConfigParser, section: str, key: str, fallback: str
) -> str:
    return _strip_inline_comment(cfg.get(section, key, fallback=fallback))


def get_global_settings(*, include_custom: bool = True) -> dict[str, Any]:
    cfg = _load_merged(
        GLOBAL_DEFAULT_FILE,
        GLOBAL_CUSTOM_FILE,
        include_custom=include_custom,
    )

    section = "global"
    bg = _normalize_hex(
        _get_option(
            cfg,
            section,
            "background_color",
            GLOBAL_DEFAULTS["background_color"],
        ),
        GLOBAL_DEFAULTS["background_color"],
    )
    fg = _normalize_hex(
        _get_option(
            cfg,
            section,
            "text_color",
            GLOBAL_DEFAULTS["text_color"],
        ),
        GLOBAL_DEFAULTS["text_color"],
    )

    font_family = (
        _get_option(cfg, section, "font_family", GLOBAL_DEFAULTS["font_family"])
        or GLOBAL_DEFAULTS["font_family"]
    )
    selected_device = _normalize_device_name(
        _get_option(
            cfg,
            section,
            "selected_device",
            GLOBAL_DEFAULTS["selected_device"],
        )
    )
    body_column_mode = _get_option(
        cfg,
        section,
        "body_column_mode",
        GLOBAL_DEFAULTS["body_column_mode"],
    ).lower()
    if body_column_mode not in SUPPORTED_BODY_COLUMN_MODES:
        body_column_mode = GLOBAL_DEFAULTS["body_column_mode"]
    main_washi_enabled = _safe_bool(
        _get_option(
            cfg,
            section,
            "main_washi_enabled",
            GLOBAL_DEFAULTS["main_washi_enabled"],
        ),
        _safe_bool(GLOBAL_DEFAULTS["main_washi_enabled"], False),
    )
    main_frame_enabled = _safe_bool(
        _get_option(
            cfg,
            section,
            "main_frame_enabled",
            GLOBAL_DEFAULTS["main_frame_enabled"],
        ),
        _safe_bool(GLOBAL_DEFAULTS["main_frame_enabled"], False),
    )
    main_frame_variant = _safe_int(
        _get_option(
            cfg,
            section,
            "main_frame_variant",
            GLOBAL_DEFAULTS["main_frame_variant"],
        ),
        1,
    )
    if main_frame_variant not in {1, 2, 3}:
        main_frame_variant = 1

    cover_texture_enabled = _safe_bool(
        _get_option(
            cfg,
            section,
            "cover_texture_enabled",
            GLOBAL_DEFAULTS["cover_texture_enabled"],
        ),
        _safe_bool(GLOBAL_DEFAULTS["cover_texture_enabled"], False),
    )
    cover_texture_variant = _safe_int(
        _get_option(
            cfg,
            section,
            "cover_texture_variant",
            GLOBAL_DEFAULTS["cover_texture_variant"],
        ),
        1,
    )
    if cover_texture_variant not in {1, 2, 3}:
        cover_texture_variant = 1
    background_render_mode = _get_option(
        cfg,
        section,
        "background_render_mode",
        GLOBAL_DEFAULTS["background_render_mode"],
    ).lower()
    if background_render_mode not in SUPPORTED_BACKGROUND_RENDER_MODES:
        background_render_mode = GLOBAL_DEFAULTS["background_render_mode"]
    cover_image_path = _get_option(
        cfg,
        section,
        "cover_image_path",
        GLOBAL_DEFAULTS["cover_image_path"],
    )
    cover_image_opacity = _safe_float(
        _get_option(
            cfg,
            section,
            "cover_image_opacity",
            GLOBAL_DEFAULTS["cover_image_opacity"],
        ),
        0.92,
    )
    cover_image_opacity = min(1.0, max(0.0, cover_image_opacity))
    washi_image_path = _get_option(
        cfg,
        section,
        "washi_image_path",
        GLOBAL_DEFAULTS["washi_image_path"],
    )
    washi_image_opacity = _safe_float(
        _get_option(
            cfg,
            section,
            "washi_image_opacity",
            GLOBAL_DEFAULTS["washi_image_opacity"],
        ),
        0.18,
    )
    washi_image_opacity = min(1.0, max(0.0, washi_image_opacity))
    page_number_enabled = _safe_bool(
        _get_option(
            cfg,
            section,
            "page_number_enabled",
            GLOBAL_DEFAULTS["page_number_enabled"],
        ),
        _safe_bool(GLOBAL_DEFAULTS["page_number_enabled"], True),
    )

    return {
        "font_family": font_family,
        "selected_device": selected_device,
        "body_column_mode": body_column_mode,
        "main_washi_enabled": main_washi_enabled,
        "main_frame_enabled": main_frame_enabled,
        "main_frame_variant": main_frame_variant,
        "cover_texture_enabled": cover_texture_enabled,
        "cover_texture_variant": cover_texture_variant,
        "background_render_mode": background_render_mode,
        "cover_image_path": cover_image_path,
        "cover_image_opacity": cover_image_opacity,
        "washi_image_path": washi_image_path,
        "washi_image_opacity": washi_image_opacity,
        "page_number_enabled": page_number_enabled,
        "background_color": bg,
        "text_color": fg,
    }


def get_device_settings(
    device: str,
    *,
    include_custom: bool = True,
) -> dict[str, Any]:
    normalized_device = _normalize_device_name(device)
    orientation_hint = _resolve_device_orientation_hint(device)
    cfg = _load_merged(
        DEVICE_DEFAULT_FILE,
        DEVICE_CUSTOM_FILE,
        include_custom=include_custom,
    )
    return _load_device_settings_from_cfg(
        cfg,
        normalized_device,
        orientation_hint=orientation_hint,
    )


def _load_device_settings_from_cfg(
    cfg: configparser.ConfigParser,
    normalized_device: str,
    *,
    orientation_hint: str | None = None,
) -> dict[str, Any]:
    defaults = dict(DEVICE_DEFAULTS[normalized_device])
    mode_explicit = False
    orientation_explicit = False

    if cfg.has_section(normalized_device):
        section = normalized_device
        defaults["font_size"] = _safe_float(
            _get_option(
                cfg,
                section,
                "font_size",
                str(defaults["font_size"]),
            ),
            float(defaults["font_size"]),
        )
        defaults["width_mm"] = _safe_float(
            _get_option(cfg, section, "width_mm", str(defaults["width_mm"])),
            float(defaults["width_mm"]),
        )
        defaults["height_mm"] = _safe_float(
            _get_option(cfg, section, "height_mm", str(defaults["height_mm"])),
            float(defaults["height_mm"]),
        )
        defaults["margin_top_mm"] = _safe_float(
            _get_option(cfg, section, "margin_top_mm", str(defaults["margin_top_mm"])),
            float(defaults["margin_top_mm"]),
        )
        defaults["margin_bottom_mm"] = _safe_float(
            _get_option(
                cfg,
                section,
                "margin_bottom_mm",
                str(defaults["margin_bottom_mm"]),
            ),
            float(defaults["margin_bottom_mm"]),
        )
        defaults["margin_left_mm"] = _safe_float(
            _get_option(
                cfg, section, "margin_left_mm", str(defaults["margin_left_mm"])
            ),
            float(defaults["margin_left_mm"]),
        )
        defaults["margin_right_mm"] = _safe_float(
            _get_option(
                cfg,
                section,
                "margin_right_mm",
                str(defaults["margin_right_mm"]),
            ),
            float(defaults["margin_right_mm"]),
        )
        mode_explicit = cfg.has_option(section, "mode")
        defaults["mode"] = _get_option(cfg, section, "mode", str(defaults["mode"]))
        defaults["show_page_number"] = _safe_bool(
            _get_option(
                cfg,
                section,
                "show_page_number",
                "true" if defaults["show_page_number"] else "false",
            ),
            bool(defaults["show_page_number"]),
        )

        orientation_explicit = cfg.has_option(section, "orientation")
        defaults["orientation"] = _normalize_orientation(
            _get_option(
                cfg,
                section,
                "orientation",
                str(defaults.get("orientation", "portrait")),
            ),
            fallback=str(defaults.get("orientation", "portrait")),
        )
        defaults["line_gap_ratio"] = _safe_float(
            _get_option(
                cfg,
                section,
                "line_gap_ratio",
                str(defaults.get("line_gap_ratio", 0.5)),
            ),
            float(defaults.get("line_gap_ratio", 0.5)),
        )
        defaults["line_leading_ratio"] = _safe_float(
            _get_option(
                cfg,
                section,
                "line_leading_ratio",
                str(defaults.get("line_leading_ratio", 1.5)),
            ),
            float(defaults.get("line_leading_ratio", 1.5)),
        )
        defaults["character_spacing_zw"] = _safe_float(
            _get_option(
                cfg,
                section,
                "character_spacing_zw",
                str(defaults.get("character_spacing_zw", 0.0)),
            ),
            float(defaults.get("character_spacing_zw", 0.0)),
        )

    if defaults["mode"] not in {"single_column", "two_column"}:
        defaults["mode"] = "single_column"

    orientation = _normalize_orientation(
        str(defaults.get("orientation", "portrait")),
        fallback="portrait",
    )
    if orientation_hint in SUPPORTED_ORIENTATIONS:
        orientation = str(orientation_hint)
    elif not orientation_explicit and normalized_device in TABLET_DEVICES:
        orientation = "portrait"

    if normalized_device not in DEVICE_ORIENTATION_OPTION_DEVICES:
        orientation = "portrait"
    defaults["orientation"] = orientation

    if normalized_device in DEVICE_ORIENTATION_OPTION_DEVICES and orientation == "landscape":
        defaults["width_mm"], defaults["height_mm"] = (
            float(defaults["height_mm"]),
            float(defaults["width_mm"]),
        )
        if normalized_device in TABLET_DEVICES and (
            not mode_explicit or orientation_hint == "landscape"
        ):
            defaults["mode"] = "two_column"

    if normalized_device in SMARTPHONE_DEVICES:
        defaults["mode"] = "single_column"
        defaults["show_page_number"] = False

    line_gap_ratio = float(defaults.get("line_gap_ratio", 0.5))
    if not (0.0 <= line_gap_ratio <= 2.0):
        line_gap_ratio = 0.5
    defaults["line_gap_ratio"] = line_gap_ratio

    line_leading_ratio = float(defaults.get("line_leading_ratio", 1.5))
    if line_leading_ratio <= 0.0:
        line_leading_ratio = 1.0 + line_gap_ratio
    defaults["line_leading_ratio"] = line_leading_ratio

    character_spacing = float(defaults.get("character_spacing_zw", 0.0))
    if not (-0.5 <= character_spacing <= 1.0):
        character_spacing = 0.0
    defaults["character_spacing_zw"] = character_spacing

    return defaults


def get_all_device_settings(*, include_custom: bool = True) -> dict[str, dict[str, Any]]:
    # 全デバイス取得時は ini を一度だけ読み込み、I/O を削減する。
    cfg = _load_merged(
        DEVICE_DEFAULT_FILE,
        DEVICE_CUSTOM_FILE,
        include_custom=include_custom,
    )
    return {
        device: _load_device_settings_from_cfg(cfg, device)
        for device in SUPPORTED_DEVICES
    }


def save_global_custom_settings(settings: dict[str, Any]) -> None:
    ensure_config_files()
    parser = _new_parser()
    parser.read(GLOBAL_CUSTOM_FILE, encoding="utf-8")
    if not parser.has_section("global"):
        parser.add_section("global")

    for key, value in settings.items():
        if key not in GLOBAL_ALLOWED_KEYS or value is None:
            continue
        parser.set("global", key, str(value))

    _write_parser(GLOBAL_CUSTOM_FILE, parser)


def save_device_custom_settings(settings_by_device: dict[str, dict[str, Any]]) -> None:
    ensure_config_files()
    parser = _new_parser()
    parser.read(DEVICE_CUSTOM_FILE, encoding="utf-8")

    for device, updates in settings_by_device.items():
        normalized_device = _normalize_device_name(str(device))
        if normalized_device not in SUPPORTED_DEVICES or not isinstance(updates, dict):
            continue
        if not parser.has_section(normalized_device):
            parser.add_section(normalized_device)
        for key, value in updates.items():
            if key not in DEVICE_ALLOWED_KEYS or value is None:
                continue
            if key == "orientation":
                value = _normalize_orientation(
                    str(value),
                    fallback=str(DEVICE_DEFAULTS[normalized_device]["orientation"]),
                )
            parser.set(normalized_device, key, str(value))

    _write_parser(DEVICE_CUSTOM_FILE, parser)


def save_settings(payload: dict[str, Any]) -> dict[str, Any]:
    global_payload = payload.get("global")
    device_payload = payload.get("devices")

    if isinstance(global_payload, dict):
        save_global_custom_settings(global_payload)
    if isinstance(device_payload, dict):
        save_device_custom_settings(device_payload)

    return export_settings_for_api()


def reset_custom_settings() -> dict[str, Any]:
    ensure_config_files()
    GLOBAL_CUSTOM_FILE.write_text("", encoding="utf-8")
    DEVICE_CUSTOM_FILE.write_text("", encoding="utf-8")
    return export_settings_for_api()


def export_settings_for_api() -> dict[str, Any]:
    return {
        "global": get_global_settings(),
        "devices": get_all_device_settings(),
    }


def get_device_api_payload(
    *,
    include_custom: bool = True,
) -> dict[str, dict[str, Any]]:
    devices = get_all_device_settings(include_custom=include_custom)
    payload: dict[str, dict[str, Any]] = {}
    for index, device in enumerate(SUPPORTED_DEVICES):
        profile = devices[device]
        base_profile = DEVICE_DEFAULTS[device]
        payload[device] = {
            "width": profile["width_mm"],
            "height": profile["height_mm"],
            "width_mm": profile["width_mm"],
            "height_mm": profile["height_mm"],
            "base_width": base_profile["width_mm"],
            "base_height": base_profile["height_mm"],
            "font_size": profile["font_size"],
            "label": DEVICE_LABELS.get(device, device),
            "category": DEVICE_CATEGORIES.get(device, "device"),
            "default": index == 0,
            "mode": profile["mode"],
            "show_page_number": profile["show_page_number"],
            "orientation": profile.get("orientation", "portrait"),
            "supports_orientation": device in DEVICE_ORIENTATION_OPTION_DEVICES,
            "supports_columns": device in DEVICE_COLUMN_OPTION_DEVICES,
        }
    return payload


_DEVICE_DEFAULT_FLOAT_KEYS = (
    "font_size",
    "width_mm",
    "height_mm",
    "margin_top_mm",
    "margin_bottom_mm",
    "margin_left_mm",
    "margin_right_mm",
    "line_gap_ratio",
    "line_leading_ratio",
    "character_spacing_zw",
)


def _apply_device_default_constraints(
    device: str,
    profile: dict[str, Any],
) -> dict[str, Any]:
    """初期値プロファイルに読込側（_load_device_settings_from_cfg）と同じ制約を適用する。"""
    factory = DEVICE_DEFAULTS[device]

    if device in SMARTPHONE_DEVICES:
        profile["mode"] = "single_column"
        profile["show_page_number"] = False
        profile["orientation"] = "portrait"

    if profile.get("mode") not in SUPPORTED_BODY_COLUMN_MODES:
        profile["mode"] = "single_column"
    if profile.get("orientation") not in SUPPORTED_ORIENTATIONS:
        profile["orientation"] = str(factory["orientation"])

    if float(profile["font_size"]) <= 0:
        profile["font_size"] = factory["font_size"]
    if float(profile["width_mm"]) <= 0:
        profile["width_mm"] = factory["width_mm"]
    if float(profile["height_mm"]) <= 0:
        profile["height_mm"] = factory["height_mm"]
    for key in ("margin_top_mm", "margin_bottom_mm", "margin_left_mm", "margin_right_mm"):
        if float(profile[key]) < 0:
            profile[key] = factory[key]

    if not 0.0 <= float(profile["line_gap_ratio"]) <= 2.0:
        profile["line_gap_ratio"] = 0.5
    if float(profile["line_leading_ratio"]) <= 0:
        profile["line_leading_ratio"] = 1.0 + float(profile["line_gap_ratio"])
    if not -0.5 <= float(profile["character_spacing_zw"]) <= 1.0:
        profile["character_spacing_zw"] = 0.0

    return profile


def _load_device_default_profiles() -> dict[str, dict[str, Any]]:
    """default.ini の生の値を読み込む。

    custom はマージせず、landscape 時の幅高スワップ等の読込時変換も行わない
    （初期値編集UIには保存されている値そのものを見せるため）。
    ファイルが無い場合は ensure_config_files() が生成する。
    """
    ensure_config_files()
    parser = _new_parser()
    parser.read(DEVICE_DEFAULT_FILE, encoding="utf-8")

    profiles: dict[str, dict[str, Any]] = {}
    for device in SUPPORTED_DEVICES:
        profile = dict(DEVICE_DEFAULTS[device])
        if parser.has_section(device):
            section = parser[device]
            for key in _DEVICE_DEFAULT_FLOAT_KEYS:
                if key in section:
                    profile[key] = _safe_float(section[key], float(profile[key]))
            if "mode" in section:
                mode = _strip_inline_comment(section["mode"]).strip().lower()
                if mode in SUPPORTED_BODY_COLUMN_MODES:
                    profile["mode"] = mode
            if "show_page_number" in section:
                profile["show_page_number"] = _safe_bool(
                    section["show_page_number"],
                    bool(profile["show_page_number"]),
                )
            if "orientation" in section:
                profile["orientation"] = _normalize_orientation(
                    section["orientation"],
                    fallback=str(profile["orientation"]),
                )
        profiles[device] = _apply_device_default_constraints(device, profile)
    return profiles


def get_device_default_file_info() -> dict[str, str]:
    """初期値ファイルの場所情報（UI 表示・外部エディタ起動用）を返す。"""
    ensure_config_files()
    return {
        "path": str(DEVICE_DEFAULT_FILE),
        "directory": str(CONFIG_DIR),
        "filename": DEVICE_DEFAULT_FILE.name,
    }


def get_device_default_settings() -> dict[str, dict[str, Any]]:
    """初期値編集UI用のペイロード（全端末の初期値＋表示メタ情報）を返す。"""
    profiles = _load_device_default_profiles()
    payload: dict[str, dict[str, Any]] = {}
    for device in SUPPORTED_DEVICES:
        payload[device] = {
            **profiles[device],
            "label": DEVICE_LABELS.get(device, device),
            "category": DEVICE_CATEGORIES.get(device, "device"),
            "supports_orientation": device in DEVICE_ORIENTATION_OPTION_DEVICES,
            "supports_columns": device in DEVICE_COLUMN_OPTION_DEVICES,
        }
    return payload


def save_device_default_settings(
    settings_by_device: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """初期値（default.ini）を更新する。custom.ini には触れない。"""
    profiles = _load_device_default_profiles()

    for device, updates in settings_by_device.items():
        normalized_device = _normalize_device_name(str(device))
        if normalized_device not in SUPPORTED_DEVICES or not isinstance(updates, dict):
            continue
        profile = profiles[normalized_device]
        for key, value in updates.items():
            if key not in DEVICE_ALLOWED_KEYS or value is None:
                continue
            if key == "orientation":
                profile[key] = _normalize_orientation(
                    str(value),
                    fallback=str(profile[key]),
                )
            elif key == "mode":
                mode = str(value).strip().lower()
                if mode in SUPPORTED_BODY_COLUMN_MODES:
                    profile[key] = mode
            elif key == "show_page_number":
                profile[key] = _safe_bool(str(value), bool(profile[key]))
            else:
                profile[key] = _safe_float(str(value), float(profile[key]))
        profiles[normalized_device] = _apply_device_default_constraints(
            normalized_device,
            profile,
        )

    DEVICE_DEFAULT_FILE.write_text(
        _render_device_default_ini(profiles),
        encoding="utf-8",
    )
    return get_device_default_settings()


def reset_device_default_settings() -> dict[str, dict[str, Any]]:
    """初期値（default.ini）を工場出荷値（DEVICE_DEFAULTS）に戻す。"""
    ensure_config_files()
    DEVICE_DEFAULT_FILE.write_text(_render_device_default_ini(), encoding="utf-8")
    return get_device_default_settings()
