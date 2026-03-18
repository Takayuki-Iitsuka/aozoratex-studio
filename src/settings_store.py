from __future__ import annotations

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
LEGACY_SETTINGS_FILES = (
    PROJECT_ROOT / "settings.ini",
    CONFIG_DIR / "settings.legacy.ini",
)
LEGACY_MIGRATION_MARKER = CONFIG_DIR / ".legacy_migrated"

SUPPORTED_COLOR_MODES = ("light", "dark", "intermediate")
SUPPORTED_DEVICES = ("iphone", "android", "ipad", "ipad_landscape", "pc")

DEVICE_LABELS: dict[str, str] = {
    "iphone": "iPhone 11 (65x140mm)",
    "android": "Android Modern (70x155.5mm)",
    "ipad": "iPad Portrait (158x227mm)",
    "ipad_landscape": "iPad Landscape - 2Column (227x158mm)",
    "pc": "PC / A4 (210x297mm)",
}

GLOBAL_DEFAULTS: dict[str, str] = {
    "font_family": "Yu Mincho",
    "color_mode": "light",
    "background_color": "#FFFFFF",
    "text_color": "#000000",
    "background_color_light": "#FFFFFF",
    "text_color_light": "#000000",
    "background_color_dark": "#000000",
    "text_color_dark": "#FFFFFF",
    "background_color_intermediate": "#D3D3D3",
    "text_color_intermediate": "#4F4F4F",
}

MODE_COLOR_DEFAULTS: dict[str, tuple[str, str]] = {
    "light": ("#FFFFFF", "#000000"),
    "dark": ("#000000", "#FFFFFF"),
    "intermediate": ("#D3D3D3", "#4F4F4F"),
}

DEVICE_DEFAULTS: dict[str, dict[str, Any]] = {
    "iphone": {
        "font_size": 11,
        "characters_per_line": 33,
        "character_spacing": 0.0,
        "line_spacing": 1.0,
        "width_mm": 65.0,
        "height_mm": 140.0,
        "margin_top_mm": 5.0,
        "margin_bottom_mm": 5.0,
        "margin_left_mm": 5.0,
        "margin_right_mm": 5.0,
        "mode": "single_column",
        "show_page_number": False,
        "color_mode": "light",
    },
    "android": {
        "font_size": 11,
        "characters_per_line": 30,
        "character_spacing": 0.0,
        "line_spacing": 1.0,
        "width_mm": 70.0,
        "height_mm": 155.5,
        "margin_top_mm": 5.0,
        "margin_bottom_mm": 5.0,
        "margin_left_mm": 5.0,
        "margin_right_mm": 5.0,
        "mode": "single_column",
        "show_page_number": False,
        "color_mode": "light",
    },
    "ipad": {
        "font_size": 12,
        "characters_per_line": 35,
        "character_spacing": 0.0,
        "line_spacing": 1.0,
        "width_mm": 158.0,
        "height_mm": 227.0,
        "margin_top_mm": 10.0,
        "margin_bottom_mm": 10.0,
        "margin_left_mm": 10.0,
        "margin_right_mm": 10.0,
        "mode": "single_column",
        "show_page_number": True,
        "color_mode": "light",
    },
    "ipad_landscape": {
        "font_size": 11,
        "characters_per_line": 35,
        "character_spacing": 0.0,
        "line_spacing": 1.0,
        "width_mm": 227.0,
        "height_mm": 158.0,
        "margin_top_mm": 10.0,
        "margin_bottom_mm": 10.0,
        "margin_left_mm": 10.0,
        "margin_right_mm": 10.0,
        "mode": "two_column",
        "show_page_number": True,
        "color_mode": "light",
    },
    "pc": {
        "font_size": 12,
        "characters_per_line": 40,
        "character_spacing": 0.0,
        "line_spacing": 1.0,
        "width_mm": 210.0,
        "height_mm": 297.0,
        "margin_top_mm": 10.0,
        "margin_bottom_mm": 10.0,
        "margin_left_mm": 10.0,
        "margin_right_mm": 10.0,
        "mode": "single_column",
        "show_page_number": True,
        "color_mode": "light",
    },
}

GLOBAL_ALLOWED_KEYS = set(GLOBAL_DEFAULTS.keys())
DEVICE_ALLOWED_KEYS = {
    "font_size",
    "characters_per_line",
    "character_spacing",
    "line_spacing",
    "width_mm",
    "height_mm",
    "margin_top_mm",
    "margin_bottom_mm",
    "margin_left_mm",
    "margin_right_mm",
    "mode",
    "show_page_number",
    "color_mode",
}


def _new_parser() -> configparser.ConfigParser:
    cfg = configparser.ConfigParser(inline_comment_prefixes=(";",))
    return cfg


def _strip_inline_comment(value: str) -> str:
    return re.sub(r"\s+#.*$", "", value).strip()


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
        f"font_family = {GLOBAL_DEFAULTS['font_family']}",
        f"color_mode = {GLOBAL_DEFAULTS['color_mode']}",
        f"background_color = {GLOBAL_DEFAULTS['background_color']}",
        f"text_color = {GLOBAL_DEFAULTS['text_color']}",
        "",
    ]
    for mode in SUPPORTED_COLOR_MODES:
        bg, fg = MODE_COLOR_DEFAULTS[mode]
        lines.append(f"background_color_{mode} = {bg}")
        lines.append(f"text_color_{mode} = {fg}")
    lines.append("")
    return "\n".join(lines)


def _render_device_default_ini() -> str:
    lines: list[str] = []
    for device in SUPPORTED_DEVICES:
        profile = DEVICE_DEFAULTS[device]
        lines.append(f"[{device}]")
        lines.append(f"font_size = {profile['font_size']}")
        lines.append(f"characters_per_line = {profile['characters_per_line']}")
        lines.append(f"character_spacing = {profile['character_spacing']}")
        lines.append(f"line_spacing = {profile['line_spacing']}")
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
        lines.append(f"color_mode = {profile['color_mode']}")
        lines.append("")
    return "\n".join(lines)


def _is_empty_or_missing(path: Path) -> bool:
    if not path.exists():
        return True
    return not path.read_text(encoding="utf-8").strip()


def _migrate_from_legacy_if_needed() -> None:
    if LEGACY_MIGRATION_MARKER.exists():
        return

    legacy_file = next((path for path in LEGACY_SETTINGS_FILES if path.exists()), None)
    if legacy_file is None:
        LEGACY_MIGRATION_MARKER.write_text("no_legacy\n", encoding="utf-8")
        return
    if not (_is_empty_or_missing(GLOBAL_CUSTOM_FILE) and _is_empty_or_missing(DEVICE_CUSTOM_FILE)):
        LEGACY_MIGRATION_MARKER.write_text("custom_exists\n", encoding="utf-8")
        return

    legacy = _new_parser()
    legacy.read(legacy_file, encoding="utf-8")
    if not legacy.has_section("PDF"):
        LEGACY_MIGRATION_MARKER.write_text("legacy_pdf_section_missing\n", encoding="utf-8")
        return

    global_updates: dict[str, Any] = {}
    section = "PDF"
    mapping = {
        "font": "font_family",
        "color_mode": "color_mode",
        "background_color": "background_color",
        "text_color": "text_color",
        "background_color_light": "background_color_light",
        "text_color_light": "text_color_light",
        "background_color_dark": "background_color_dark",
        "text_color_dark": "text_color_dark",
        "background_color_intermediate": "background_color_intermediate",
        "text_color_intermediate": "text_color_intermediate",
    }
    for old_key, new_key in mapping.items():
        if legacy.has_option(section, old_key):
            global_updates[new_key] = _strip_inline_comment(legacy.get(section, old_key))

    device_updates: dict[str, dict[str, Any]] = {}
    for device in SUPPORTED_DEVICES:
        sec = f"PDF_{device}"
        if not legacy.has_section(sec):
            continue
        updates: dict[str, Any] = {}
        key_map = {
            "font_size": "font_size",
            "characters_per_line": "characters_per_line",
            "line_spacing": "line_spacing",
        }
        for old_key, new_key in key_map.items():
            if legacy.has_option(sec, old_key):
                updates[new_key] = _strip_inline_comment(legacy.get(sec, old_key))

        width_key = f"{device}_width"
        height_key = f"{device}_height"
        if legacy.has_option(sec, "width"):
            updates["width_mm"] = _strip_inline_comment(legacy.get(sec, "width"))
        elif legacy.has_option(sec, width_key):
            updates["width_mm"] = _strip_inline_comment(legacy.get(sec, width_key))

        if legacy.has_option(sec, "height"):
            updates["height_mm"] = _strip_inline_comment(legacy.get(sec, "height"))
        elif legacy.has_option(sec, height_key):
            updates["height_mm"] = _strip_inline_comment(legacy.get(sec, height_key))

        if updates:
            device_updates[device] = updates

    if global_updates:
        global_parser = _new_parser()
        global_parser.read(GLOBAL_CUSTOM_FILE, encoding="utf-8")
        if not global_parser.has_section("global"):
            global_parser.add_section("global")
        for key, value in global_updates.items():
            if key in GLOBAL_ALLOWED_KEYS and value is not None:
                global_parser.set("global", key, str(value))
        _write_parser(GLOBAL_CUSTOM_FILE, global_parser)

    if device_updates:
        device_parser = _new_parser()
        device_parser.read(DEVICE_CUSTOM_FILE, encoding="utf-8")
        for device, updates in device_updates.items():
            if device not in SUPPORTED_DEVICES:
                continue
            if not device_parser.has_section(device):
                device_parser.add_section(device)
            for key, value in updates.items():
                if key in DEVICE_ALLOWED_KEYS and value is not None:
                    device_parser.set(device, key, str(value))
        _write_parser(DEVICE_CUSTOM_FILE, device_parser)

    LEGACY_MIGRATION_MARKER.write_text("migrated\n", encoding="utf-8")


def ensure_config_files(run_migration: bool = True) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    if not GLOBAL_DEFAULT_FILE.exists():
        GLOBAL_DEFAULT_FILE.write_text(_render_global_default_ini(), encoding="utf-8")
    if not DEVICE_DEFAULT_FILE.exists():
        DEVICE_DEFAULT_FILE.write_text(_render_device_default_ini(), encoding="utf-8")
    if not GLOBAL_CUSTOM_FILE.exists():
        GLOBAL_CUSTOM_FILE.write_text("", encoding="utf-8")
    if not DEVICE_CUSTOM_FILE.exists():
        DEVICE_CUSTOM_FILE.write_text("", encoding="utf-8")

    if run_migration:
        _migrate_from_legacy_if_needed()


def _load_merged(default_file: Path, custom_file: Path) -> configparser.ConfigParser:
    ensure_config_files()
    cfg = _new_parser()
    cfg.read(default_file, encoding="utf-8")
    cfg.read(custom_file, encoding="utf-8")
    return cfg


def _get_option(cfg: configparser.ConfigParser, section: str, key: str, fallback: str) -> str:
    return _strip_inline_comment(cfg.get(section, key, fallback=fallback))


def get_global_settings() -> dict[str, Any]:
    cfg = _load_merged(GLOBAL_DEFAULT_FILE, GLOBAL_CUSTOM_FILE)

    section = "global"
    mode_fallback = GLOBAL_DEFAULTS["color_mode"]
    mode = _get_option(cfg, section, "color_mode", mode_fallback).lower()
    if mode not in SUPPORTED_COLOR_MODES:
        mode = mode_fallback

    mode_colors: dict[str, dict[str, str]] = {}
    for color_mode in SUPPORTED_COLOR_MODES:
        d_bg, d_fg = MODE_COLOR_DEFAULTS[color_mode]
        bg = _normalize_hex(
            _get_option(cfg, section, f"background_color_{color_mode}", d_bg),
            d_bg,
        )
        fg = _normalize_hex(
            _get_option(cfg, section, f"text_color_{color_mode}", d_fg),
            d_fg,
        )
        mode_colors[color_mode] = {"background_color": bg, "text_color": fg}

    selected = mode_colors[mode]
    bg = _normalize_hex(
        _get_option(cfg, section, "background_color", selected["background_color"]),
        selected["background_color"],
    )
    fg = _normalize_hex(
        _get_option(cfg, section, "text_color", selected["text_color"]),
        selected["text_color"],
    )

    font_family = _get_option(
        cfg, section, "font_family", GLOBAL_DEFAULTS["font_family"]
    ) or GLOBAL_DEFAULTS["font_family"]

    return {
        "font_family": font_family,
        "color_mode": mode,
        "background_color": bg,
        "text_color": fg,
        "modes": mode_colors,
    }


def get_mode_colors(mode: str) -> tuple[str, str]:
    global_settings = get_global_settings()
    normalized_mode = mode.lower()
    if normalized_mode not in SUPPORTED_COLOR_MODES:
        normalized_mode = global_settings["color_mode"]
    mode_colors = global_settings["modes"][normalized_mode]
    return mode_colors["background_color"], mode_colors["text_color"]


def get_device_settings(device: str) -> dict[str, Any]:
    normalized_device = (device or "iphone").strip().lower()
    if normalized_device not in SUPPORTED_DEVICES:
        normalized_device = "iphone"

    defaults = dict(DEVICE_DEFAULTS[normalized_device])
    cfg = _load_merged(DEVICE_DEFAULT_FILE, DEVICE_CUSTOM_FILE)

    if cfg.has_section(normalized_device):
        section = normalized_device
        defaults["font_size"] = _safe_int(
            _get_option(
                cfg,
                section,
                "font_size",
                str(defaults["font_size"]),
            ),
            int(defaults["font_size"]),
        )
        defaults["characters_per_line"] = _safe_int(
            _get_option(
                cfg,
                section,
                "characters_per_line",
                str(defaults["characters_per_line"]),
            ),
            int(defaults["characters_per_line"]),
        )
        defaults["character_spacing"] = _safe_float(
            _get_option(
                cfg,
                section,
                "character_spacing",
                str(defaults["character_spacing"]),
            ),
            float(defaults["character_spacing"]),
        )
        defaults["line_spacing"] = _safe_float(
            _get_option(
                cfg,
                section,
                "line_spacing",
                str(defaults["line_spacing"]),
            ),
            float(defaults["line_spacing"]),
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
            _get_option(cfg, section, "margin_left_mm", str(defaults["margin_left_mm"])),
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

        color_mode = _get_option(
            cfg,
            section,
            "color_mode",
            str(defaults["color_mode"]),
        ).lower()
        if color_mode in SUPPORTED_COLOR_MODES:
            defaults["color_mode"] = color_mode

    if defaults["mode"] not in {"single_column", "two_column"}:
        defaults["mode"] = "single_column"

    return defaults


def get_all_device_settings() -> dict[str, dict[str, Any]]:
    return {device: get_device_settings(device) for device in SUPPORTED_DEVICES}


def resolve_color_mode(device: str, mode_override: str | None = None) -> str:
    if mode_override:
        mode = mode_override.lower()
        if mode in SUPPORTED_COLOR_MODES:
            return mode

    device_settings = get_device_settings(device)
    device_mode = str(device_settings.get("color_mode", "")).lower()
    if device_mode in SUPPORTED_COLOR_MODES:
        return device_mode

    return str(get_global_settings()["color_mode"])


def save_global_custom_settings(settings: dict[str, Any]) -> None:
    ensure_config_files(run_migration=False)
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
    ensure_config_files(run_migration=False)
    parser = _new_parser()
    parser.read(DEVICE_CUSTOM_FILE, encoding="utf-8")

    for device, updates in settings_by_device.items():
        normalized_device = str(device).strip().lower()
        if normalized_device not in SUPPORTED_DEVICES or not isinstance(updates, dict):
            continue
        if not parser.has_section(normalized_device):
            parser.add_section(normalized_device)
        for key, value in updates.items():
            if key not in DEVICE_ALLOWED_KEYS or value is None:
                continue
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
    ensure_config_files(run_migration=False)
    GLOBAL_CUSTOM_FILE.write_text("", encoding="utf-8")
    DEVICE_CUSTOM_FILE.write_text("", encoding="utf-8")
    LEGACY_MIGRATION_MARKER.write_text("manual_reset\n", encoding="utf-8")
    return export_settings_for_api()


def export_settings_for_api() -> dict[str, Any]:
    return {
        "global": get_global_settings(),
        "devices": get_all_device_settings(),
    }


def get_device_api_payload() -> dict[str, dict[str, Any]]:
    devices = get_all_device_settings()
    payload: dict[str, dict[str, Any]] = {}
    for index, device in enumerate(SUPPORTED_DEVICES):
        profile = devices[device]
        payload[device] = {
            "width": profile["width_mm"],
            "height": profile["height_mm"],
            "label": DEVICE_LABELS.get(device, device),
            "default": index == 0,
            "mode": profile["mode"],
            "show_page_number": profile["show_page_number"],
        }
    return payload
