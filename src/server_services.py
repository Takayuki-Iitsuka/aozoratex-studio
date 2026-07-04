from __future__ import annotations

import csv
import io
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from src import aozoratex
from src import settings_store
from src.aozoratex_generate import generate_tex_for_source

WORKDIR = Path(__file__).resolve().parent.parent
DATA_DIR = WORKDIR / "data"
CACHE_DIR = WORKDIR / "cache"
OUT_DIR = WORKDIR / "out"
WORK_OUT_DIR = OUT_DIR / "work"
PDF_OUT_DIR = OUT_DIR / "pdf"
LEGACY_SESSION_DIR = OUT_DIR / "session"
STATIC_DIR = WORKDIR / "static"
COLOR_PALETTE_FILE = STATIC_DIR / "color-palettes.json"
FONT_LIST_ENTRY = WORKDIR / "tools" / "fonts" / "texlive_font_list.py"
FONT_LIST_CSV = WORKDIR / "tools" / "fonts" / "texlive_fonts.csv"
MAX_COLOR_SCHEMES = 36
BODY_COLUMN_OPTION_DEVICES = settings_store.DEVICE_COLUMN_OPTION_DEVICES

_FONT_CACHE_MTIME: Optional[float] = None
_FONT_CACHE_FONTS: list[dict] = []
_FONT_CACHE_META: dict[str, object] = {}

logger = logging.getLogger(__name__)


def _normalize_device_name(device: Optional[str]) -> str:
    return settings_store.normalize_device_name(device)


def command_to_log_text(cmd: list[str]) -> str:
    return subprocess.list2cmdline(cmd)


def resolve_python_executable() -> str:
    venv_python = WORKDIR / ".venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)
    return shutil.which("python") or "python"


def _decode_output(data: Optional[bytes]) -> str:
    if data is None:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("cp932", errors="replace")


def _safe_mkdir(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        logger.warning("Cannot create directory %s: %s", path, exc)


def initialize_runtime() -> None:
    settings_store.ensure_config_files()

    for directory in (OUT_DIR, WORK_OUT_DIR, PDF_OUT_DIR, STATIC_DIR):
        _safe_mkdir(directory)

    try:
        migration = migrate_legacy_session_outputs()
        if migration["moved_files"] > 0:
            logger.info(
                "Migrated legacy out/session outputs: moved=%s overwritten=%s",
                migration["moved_files"],
                migration["overwritten_files"],
            )
        organize_session_outputs()
    except PermissionError as exc:
        logger.warning("Skipping startup output organize due permission error: %s", exc)


def _load_color_data() -> dict:
    try:
        return json.loads(COLOR_PALETTE_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.exception("Failed to load color palette JSON: %s", exc)
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


def _hex_to_hsv(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0

    max_v = max(r, g, b)
    min_v = min(r, g, b)
    delta = max_v - min_v

    hue = 0.0
    if delta != 0:
        if max_v == r:
            hue = 60.0 * (((g - b) / delta) % 6)
        elif max_v == g:
            hue = 60.0 * (((b - r) / delta) + 2)
        else:
            hue = 60.0 * (((r - g) / delta) + 4)

    sat = 0.0 if max_v == 0 else (delta / max_v)
    val = max_v
    return hue, sat, val


def _scheme_hue(scheme: dict) -> float:
    try:
        hue, _sat, _val = _hex_to_hsv(str(scheme.get("bg", "#000000")))
        return hue
    except Exception:
        return 0.0


def limit_color_schemes_balanced(schemes: list[dict], limit: int) -> list[dict]:
    if limit <= 0:
        return []

    deduped: list[dict] = []
    seen_exact: set[str] = set()
    for item in schemes:
        key = (
            f"{item.get('category', '')}|{item.get('mode', '')}|"
            f"{item.get('bg', '')}|{item.get('fg', '')}"
        )
        if key in seen_exact:
            continue
        seen_exact.add(key)
        deduped.append(item)

    if len(deduped) <= limit:
        return deduped

    groups: dict[str, list[dict]] = {}
    for item in deduped:
        group_key = f"{item.get('category', 'Unknown')}|{item.get('mode', 'unknown')}"
        groups.setdefault(group_key, []).append(item)

    ordered_group_keys = sorted(groups.keys())
    for key in ordered_group_keys:
        groups[key].sort(
            key=lambda item: (
                _scheme_hue(item),
                -_contrast(
                    str(item.get("bg", "#000000")),
                    str(item.get("fg", "#FFFFFF")),
                ),
                str(item.get("name", "")),
            )
        )

    base = max(1, limit // max(1, len(ordered_group_keys)))
    quotas = {key: min(len(groups[key]), base) for key in ordered_group_keys}
    assigned = sum(quotas.values())

    while assigned < limit:
        progressed = False
        for key in ordered_group_keys:
            if assigned >= limit:
                break
            if quotas[key] >= len(groups[key]):
                continue
            quotas[key] += 1
            assigned += 1
            progressed = True
        if not progressed:
            break

    picked_by_group: dict[str, list[dict]] = {}
    for key in ordered_group_keys:
        bucket = groups[key]
        quota = quotas[key]
        if quota <= 0:
            picked_by_group[key] = []
            continue
        if quota >= len(bucket):
            picked_by_group[key] = list(bucket)
            continue
        if quota == 1:
            picked_by_group[key] = [bucket[len(bucket) // 2]]
            continue

        sampled: list[dict] = []
        max_idx = len(bucket) - 1
        for i in range(quota):
            idx = round(i * max_idx / (quota - 1))
            sampled.append(bucket[idx])
        picked_by_group[key] = sampled

    selected: list[dict] = []
    cursor = {key: 0 for key in ordered_group_keys}
    while len(selected) < limit:
        progressed = False
        for key in ordered_group_keys:
            idx = cursor[key]
            bucket = picked_by_group[key]
            if idx >= len(bucket):
                continue
            selected.append(bucket[idx])
            cursor[key] = idx + 1
            progressed = True
            if len(selected) >= limit:
                break
        if not progressed:
            break

    return selected[:limit]


def _str_to_bool_flag(raw: Optional[str]) -> bool:
    if raw is None:
        return False
    value = raw.strip().lower()
    return value in {"1", "true", "yes", "on", "y", "t", "✓"}


def _run_font_list_export() -> tuple[bool, str]:
    if not FONT_LIST_ENTRY.exists():
        return False, f"font list script not found: {FONT_LIST_ENTRY}"

    cmd = [
        resolve_python_executable(),
        str(FONT_LIST_ENTRY),
        "--output",
        str(FONT_LIST_CSV),
        "--japanese-only",
    ]
    logger.info("[font-list] command: %s", command_to_log_text(cmd))
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=120, cwd=WORKDIR)
    except subprocess.TimeoutExpired:
        return False, "font list export timeout"
    except OSError as exc:
        return False, f"font list export failed to start: {exc}"

    stdout_text = _decode_output(proc.stdout).strip()
    stderr_text = _decode_output(proc.stderr).strip()
    if stdout_text:
        logger.info("[font-list stdout]\n%s", stdout_text)
    if stderr_text:
        logger.warning("[font-list stderr]\n%s", stderr_text)
    if proc.returncode != 0:
        msg = stderr_text or stdout_text or "unknown error"
        return False, f"font list export failed: {msg}"

    return True, stdout_text or "font list export completed"


def load_lualatex_fonts(refresh: bool) -> tuple[list[dict], dict]:
    global _FONT_CACHE_MTIME, _FONT_CACHE_FONTS, _FONT_CACHE_META

    if not refresh and FONT_LIST_CSV.exists():
        current_mtime = FONT_LIST_CSV.stat().st_mtime
        if _FONT_CACHE_MTIME == current_mtime and _FONT_CACHE_FONTS:
            cached_meta = dict(_FONT_CACHE_META)
            cached_meta["refreshed"] = False
            return list(_FONT_CACHE_FONTS), cached_meta

    message = ""
    refreshed = False

    if refresh or not FONT_LIST_CSV.exists():
        refreshed = True
        ok, message = _run_font_list_export()
        if not ok:
            logger.warning("%s", message)

    fonts: list[dict] = []
    seen_names: set[str] = set()

    if FONT_LIST_CSV.exists():
        try:
            with FONT_LIST_CSV.open("r", encoding="utf-8-sig", newline="") as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    family = (row.get("latex_name") or row.get("family") or "").strip()
                    display_name = (row.get("display_name") or family).strip()
                    style = (row.get("style") or "Regular").strip()
                    latex_command = (
                        row.get("latex_command") or row.get("latex_cmd") or ""
                    ).strip()

                    is_japanese = _str_to_bool_flag(
                        row.get("japanese_candidate")
                    ) or _str_to_bool_flag(row.get("is_japanese"))
                    if not is_japanese:
                        continue

                    if not family:
                        continue

                    recommended = _str_to_bool_flag(
                        row.get("recommended_for_aozoratex")
                    ) or _str_to_bool_flag(row.get("recommended"))

                    normalized = family.lower()
                    if normalized in seen_names:
                        continue
                    seen_names.add(normalized)

                    fonts.append(
                        {
                            "name": family,
                            "display_name": display_name,
                            "style": style,
                            "recommended": recommended,
                            "latex_command": latex_command,
                        }
                    )
        except (OSError, csv.Error) as exc:
            logger.exception("Failed to read font CSV %s: %s", FONT_LIST_CSV, exc)
            message = message or f"font csv read failed: {exc}"

    fonts.sort(
        key=lambda item: (
            0 if item["recommended"] else 1,
            item["display_name"].lower(),
        )
    )

    meta = {
        "refreshed": refreshed,
        "message": message,
        "csv_path": str(FONT_LIST_CSV.relative_to(WORKDIR))
        if FONT_LIST_CSV.exists()
        else "",
        "lualatex_available": bool(shutil.which("lualatex")),
    }

    if FONT_LIST_CSV.exists():
        _FONT_CACHE_MTIME = FONT_LIST_CSV.stat().st_mtime
        _FONT_CACHE_FONTS = list(fonts)
        _FONT_CACHE_META = dict(meta)

    return fonts, meta


def build_color_schemes(mode: str) -> list[dict]:
    normalized_mode = str(mode or "light").strip().lower()
    if normalized_mode == "intermediate":
        normalized_mode = "all"

    data = _load_color_data()
    palettes = data.get("palettes", {})
    categories = data.get("categories", [])
    preset_modes = data.get("preset_modes", {})

    if normalized_mode in preset_modes:
        return list(preset_modes.get(normalized_mode, []))

    schemes: list[dict] = []
    for category in categories:
        cat_name = category.get("name", "Category")
        lights = palettes.get(category.get("lights", ""), [])
        darks = palettes.get(category.get("darks", ""), [])

        if normalized_mode in ("light", "all"):
            for bg in lights:
                for fg in darks:
                    if _contrast(bg["c"], fg["c"]) >= 4.5:
                        schemes.append(
                            {
                                "name": f"{bg['n']} × {fg['n']}",
                                "category": f"{cat_name} (Light Mode)",
                                "mode": "light",
                                "bg": bg["c"],
                                "fg": fg["c"],
                            }
                        )

        if normalized_mode in ("dark", "all"):
            for bg in darks:
                for fg in lights:
                    if _contrast(bg["c"], fg["c"]) >= 4.5:
                        schemes.append(
                            {
                                "name": f"{bg['n']} × {fg['n']}",
                                "category": f"{cat_name} (Dark Mode)",
                                "mode": "dark",
                                "bg": bg["c"],
                                "fg": fg["c"],
                            }
                        )

    return schemes


def to_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    return bool(value)


def resolve_generation_defaults(
    device: Optional[str],
    bg_color: Optional[str],
    fg_color: Optional[str],
) -> tuple[str, str, str]:
    normalized_device = _normalize_device_name(device)
    global_settings = settings_store.get_global_settings()
    default_bg = str(global_settings.get("background_color", "#FFFFFF"))
    default_fg = str(global_settings.get("text_color", "#000000"))
    return (
        normalized_device,
        str(bg_color or default_bg),
        str(fg_color or default_fg),
    )


def resolve_decoration_options(payload: dict) -> dict[str, object]:
    global_settings = settings_store.get_global_settings()
    request_device = _normalize_device_name(str(payload.get("device") or ""))
    request_device_settings = settings_store.get_device_settings(request_device)

    def read_variant_default(key: str, fallback: int = 1) -> int:
        try:
            value = int(global_settings.get(key, fallback))
        except (TypeError, ValueError):
            value = fallback
        return value if value in (1, 2, 3) else fallback

    def pick_bool(key: str, fallback: bool) -> bool:
        if key in payload:
            return to_bool(payload.get(key), default=fallback)
        return fallback

    def pick_variant(key: str, fallback: int) -> int:
        if key in payload:
            try:
                v = int(payload.get(key))
            except (TypeError, ValueError):
                v = fallback
        else:
            v = fallback
        return v if v in (1, 2, 3) else fallback

    def normalize_body_column_mode(value: object, fallback: str) -> str:
        mode = str(value or "").strip().lower()
        if mode in settings_store.SUPPORTED_BODY_COLUMN_MODES:
            return mode
        return fallback

    def normalize_orientation(value: object, fallback: str) -> str:
        orientation = str(value or "").strip().lower()
        if orientation in settings_store.SUPPORTED_ORIENTATIONS:
            return orientation
        return fallback

    def normalize_render_mode(value: object, fallback: str) -> str:
        mode = str(value or "").strip().lower()
        if mode in settings_store.SUPPORTED_BACKGROUND_RENDER_MODES:
            return mode
        return fallback

    def normalize_asset_path(value: object, fallback: str = "") -> str:
        path = str(value or "").strip().replace("\\", "/")
        return path or fallback

    def normalize_opacity(value: object, fallback: float) -> float:
        try:
            opacity = float(value)
        except (TypeError, ValueError):
            opacity = fallback
        return min(1.0, max(0.0, opacity))

    main_washi_default = to_bool(
        global_settings.get("main_washi_enabled"),
        default=False,
    )
    body_column_mode_default = normalize_body_column_mode(
        request_device_settings.get(
            "mode",
            global_settings.get("body_column_mode"),
        ),
        fallback="single_column",
    )
    if request_device not in BODY_COLUMN_OPTION_DEVICES:
        body_column_mode_default = "single_column"

    resolved_body_column_mode = normalize_body_column_mode(
        payload.get("body_column_mode"),
        fallback=body_column_mode_default,
    )
    if request_device not in BODY_COLUMN_OPTION_DEVICES:
        resolved_body_column_mode = "single_column"

    device_raw = str(payload.get("device") or "").strip().lower()
    orientation_default = normalize_orientation(
        request_device_settings.get("orientation"),
        fallback="portrait",
    )
    legacy_orientation_hint = settings_store.DEVICE_ORIENTATION_HINTS.get(device_raw)
    if legacy_orientation_hint in settings_store.SUPPORTED_ORIENTATIONS:
        orientation_default = str(legacy_orientation_hint)
    resolved_device_orientation = normalize_orientation(
        payload.get("device_orientation"),
        fallback=orientation_default,
    )
    if request_device not in settings_store.DEVICE_ORIENTATION_OPTION_DEVICES:
        resolved_device_orientation = "portrait"
    if (
        request_device in settings_store.TABLET_DEVICES
        and resolved_device_orientation == "landscape"
        and "body_column_mode" not in payload
    ):
        resolved_body_column_mode = "two_column"

    return {
        "main_washi_enabled": pick_bool("main_washi_enabled", main_washi_default),
        "main_frame_enabled": pick_bool(
            "main_frame_enabled",
            to_bool(global_settings.get("main_frame_enabled"), default=False),
        ),
        "main_frame_variant": pick_variant(
            "main_frame_variant",
            read_variant_default("main_frame_variant", 1),
        ),
        "cover_texture_enabled": pick_bool(
            "cover_texture_enabled",
            to_bool(global_settings.get("cover_texture_enabled"), default=False),
        ),
        "cover_texture_variant": pick_variant(
            "cover_texture_variant",
            read_variant_default("cover_texture_variant", 1),
        ),
        "background_render_mode": normalize_render_mode(
            payload.get("background_render_mode"),
            normalize_render_mode(
                global_settings.get("background_render_mode"),
                fallback="tikz",
            ),
        ),
        "cover_image_path": normalize_asset_path(
            payload.get("cover_image_path"),
            normalize_asset_path(global_settings.get("cover_image_path"), ""),
        ),
        "cover_image_opacity": normalize_opacity(
            payload.get("cover_image_opacity"),
            normalize_opacity(global_settings.get("cover_image_opacity"), 0.92),
        ),
        "washi_image_path": normalize_asset_path(
            payload.get("washi_image_path"),
            normalize_asset_path(global_settings.get("washi_image_path"), ""),
        ),
        "washi_image_opacity": normalize_opacity(
            payload.get("washi_image_opacity"),
            normalize_opacity(global_settings.get("washi_image_opacity"), 0.18),
        ),
        "page_number_enabled": pick_bool(
            "page_number_enabled",
            to_bool(global_settings.get("page_number_enabled"), default=True),
        ),
        "body_column_mode": resolved_body_column_mode,
        "device_orientation": resolved_device_orientation,
    }


def save_generation_preferences(
    device: str,
    bg_color: str,
    fg_color: str,
    font_family: Optional[str] = None,
    decorations: Optional[dict[str, object]] = None,
) -> None:
    device = _normalize_device_name(device)
    global_updates: dict[str, object] = {
        "background_color": bg_color,
        "text_color": fg_color,
    }
    if font_family:
        global_updates["font_family"] = font_family
    if decorations:
        if "main_washi_enabled" in decorations:
            value = to_bool(decorations.get("main_washi_enabled"), default=False)
            global_updates["main_washi_enabled"] = value
        for key in (
            "main_frame_enabled",
            "main_frame_variant",
            "cover_texture_enabled",
            "cover_texture_variant",
            "background_render_mode",
            "cover_image_path",
            "cover_image_opacity",
            "washi_image_path",
            "washi_image_opacity",
            "page_number_enabled",
        ):
            if key in decorations:
                global_updates[key] = decorations[key]

    device_updates: dict[str, object] = {}
    if decorations:
        if "body_column_mode" in decorations and device in BODY_COLUMN_OPTION_DEVICES:
            device_updates["mode"] = decorations["body_column_mode"]
        if (
            "device_orientation" in decorations
            and device in settings_store.DEVICE_ORIENTATION_OPTION_DEVICES
        ):
            device_updates["orientation"] = decorations["device_orientation"]

    settings_store.save_settings(
        {"global": global_updates, "devices": {device: device_updates}}
    )


def list_source_files() -> list[dict]:
    html_files = list(DATA_DIR.glob("*.html")) + list(DATA_DIR.glob("*.xhtml"))
    index = _load_library_index()
    books_by_filename = {
        str(book.get("filename", "")): book
        for book in (index or {}).get("books", [])
        if book.get("filename")
    }

    files: list[dict] = []
    for f in sorted(html_files):
        book = books_by_filename.get(f.name, {})
        stat = f.stat()
        item = {
            "name": f.name,
            "path": str(f.relative_to(WORKDIR)),
            "downloaded_at": datetime.fromtimestamp(stat.st_mtime).astimezone().isoformat(
                timespec="seconds"
            ),
            "book_id": str(book.get("book_id", "")),
            "title": str(book.get("title", "")),
            "title_reading": str(book.get("title_reading", "")),
            "kana_type": str(book.get("kana_type", "")),
            "author": str(book.get("author", "")),
            "author_reading": str(book.get("author_reading", "")),
        }
        files.append(item)
    return files


def list_background_assets() -> dict[str, object]:
    return {
        "cover": aozoratex.list_background_assets("cover"),
        "washi": aozoratex.list_background_assets("washi"),
        "defaults": aozoratex.get_default_background_assets(),
    }


def normalize_source_input(source: object) -> Optional[str]:
    if not isinstance(source, str):
        return None
    normalized = source.strip().replace("\\", "/")
    return normalized or None


def _resolve_source_path(source: str) -> Optional[Path]:
    normalized_source = normalize_source_input(source)
    if not normalized_source:
        return None

    source_path = (WORKDIR / normalized_source).resolve()
    data_dir = DATA_DIR.resolve()
    try:
        source_path.relative_to(data_dir)
    except ValueError:
        return None
    if not source_path.exists() or not source_path.is_file():
        return None
    return source_path


def organize_session_outputs() -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PDF_OUT_DIR.mkdir(parents=True, exist_ok=True)
    WORK_OUT_DIR.mkdir(parents=True, exist_ok=True)

    moved_to_pdf = 0
    moved_to_work = 0

    for item in OUT_DIR.iterdir():
        if not item.is_file():
            continue

        if item.suffix.lower() == ".pdf":
            target = PDF_OUT_DIR / item.name
            moved_to_pdf += 1
        else:
            target = WORK_OUT_DIR / item.name
            moved_to_work += 1

        if target.exists():
            target.unlink()
        item.replace(target)

    return {
        "moved_to_pdf": moved_to_pdf,
        "moved_to_work": moved_to_work,
    }


def cleanup_non_pdf_in_session() -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PDF_OUT_DIR.mkdir(parents=True, exist_ok=True)
    WORK_OUT_DIR.mkdir(parents=True, exist_ok=True)

    deleted_files = 0
    for path in WORK_OUT_DIR.rglob("*"):
        if path.is_file() and path.suffix.lower() != ".pdf":
            path.unlink()
            deleted_files += 1

    protected_dirs = {
        OUT_DIR.resolve(),
        PDF_OUT_DIR.resolve(),
        WORK_OUT_DIR.resolve(),
    }
    for directory in sorted(
        (p for p in WORK_OUT_DIR.rglob("*") if p.is_dir()), reverse=True
    ):
        if directory.resolve() in protected_dirs:
            continue
        if not any(directory.iterdir()):
            directory.rmdir()

    return {"deleted_files": deleted_files}


def migrate_legacy_session_outputs() -> dict[str, int]:
    moved_files = 0
    overwritten_files = 0

    if not LEGACY_SESSION_DIR.exists():
        return {
            "moved_files": moved_files,
            "overwritten_files": overwritten_files,
        }

    WORK_OUT_DIR.mkdir(parents=True, exist_ok=True)
    PDF_OUT_DIR.mkdir(parents=True, exist_ok=True)

    for old_root, new_root in (
        (LEGACY_SESSION_DIR / "work", WORK_OUT_DIR),
        (LEGACY_SESSION_DIR / "pdf", PDF_OUT_DIR),
    ):
        if not old_root.exists():
            continue
        for src in old_root.rglob("*"):
            if not src.is_file():
                continue
            rel = src.relative_to(old_root)
            dst = new_root / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            if dst.exists():
                dst.unlink()
                overwritten_files += 1
            src.replace(dst)
            moved_files += 1

    for src in LEGACY_SESSION_DIR.iterdir():
        if not src.is_file():
            continue
        dst = (
            PDF_OUT_DIR / src.name
            if src.suffix.lower() == ".pdf"
            else WORK_OUT_DIR / src.name
        )
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists():
            dst.unlink()
            overwritten_files += 1
        src.replace(dst)
        moved_files += 1

    try:
        shutil.rmtree(LEGACY_SESSION_DIR)
    except OSError:
        pass

    return {
        "moved_files": moved_files,
        "overwritten_files": overwritten_files,
    }


def _device_output_dirs(device: str) -> tuple[Path, Path]:
    safe_device = (device or "unknown").strip().lower()
    work_dir = WORK_OUT_DIR / safe_device
    pdf_dir = PDF_OUT_DIR / safe_device
    return work_dir, pdf_dir


def _move_ltjruby_sidecar(tex_file: Path, output_dir: Path) -> None:
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


def _run_latexmk(
    tex_file: Path, output_dir: Path, emit_log: Optional[callable] = None
) -> tuple[bool, str]:
    latexmk_bin = shutil.which("latexmk")
    if not latexmk_bin:
        msg = "latexmk が見つかりません。TeX Live の PATH 設定を確認してください。"
        if emit_log:
            emit_log(msg + "\n")
        return False, msg

    run_cmd = [
        latexmk_bin,
        "-pdf",
        "-lualatex",
        "-silent",
        "-interaction=nonstopmode",
        "-file-line-error",
        "-synctex=1",
        "-halt-on-error",
        "-use-make",
        "-outdir=" + str(output_dir),
        "-auxdir=" + str(output_dir),
        str(tex_file),
    ]

    logger.info("[latexmk] command: %s", command_to_log_text(run_cmd))
    if emit_log:
        emit_log(f"$ {command_to_log_text(run_cmd)}\n")

    try:
        proc = subprocess.Popen(
            run_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=WORKDIR,
            bufsize=1,
        )
    except OSError as exc:
        msg = f"latexmk failed to start: {exc}"
        if emit_log:
            emit_log(msg + "\n")
        return False, msg

    outputs: list[str] = []
    if proc.stdout is not None:
        for line in iter(proc.stdout.readline, ""):
            outputs.append(line)
            if emit_log:
                emit_log(line)

    try:
        proc.wait(timeout=300)
    except subprocess.TimeoutExpired:
        proc.kill()
        msg = "latexmk timeout (300s)"
        if emit_log:
            emit_log(msg + "\n")
        return False, msg

    full_output = "".join(outputs)
    log_text = f"[latexmk] return_code={proc.returncode}\n{full_output}"
    if proc.returncode != 0:
        logger.warning("[latexmk] failed with return_code=%s", proc.returncode)
        return False, log_text

    _move_ltjruby_sidecar(tex_file, output_dir)
    return True, log_text


def generate_single(
    source: str,
    device: str,
    bg_color: str,
    fg_color: str,
    font_family: Optional[str],
    compile_pdf: bool,
    decorations: Optional[dict[str, object]] = None,
    emit_log: Optional[callable] = None,
) -> tuple[bool, dict, int]:
    device = _normalize_device_name(device)
    logger.info(
        "[generate] start source=%s device=%s compile_pdf=%s",
        source,
        device,
        compile_pdf,
    )
    source_path = _resolve_source_path(source)
    if not source_path:
        logger.error("[generate] invalid source: %s", source)
        return False, {"error": f"File not found or invalid path: {source}"}, 404

    WORK_OUT_DIR.mkdir(parents=True, exist_ok=True)
    PDF_OUT_DIR.mkdir(parents=True, exist_ok=True)
    work_dir, pdf_dir = _device_output_dirs(device)
    work_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(parents=True, exist_ok=True)

    main_washi_enabled: Optional[bool] = None
    main_frame_enabled: Optional[bool] = None
    cover_texture_enabled: Optional[bool] = None
    main_frame_variant: Optional[int] = None
    cover_texture_variant: Optional[int] = None
    background_render_mode: Optional[str] = None
    cover_image_path: Optional[str] = None
    cover_image_opacity: Optional[float] = None
    washi_image_path: Optional[str] = None
    washi_image_opacity: Optional[float] = None
    page_number_enabled: Optional[bool] = None
    body_column_mode: Optional[str] = None
    device_orientation: Optional[str] = None

    if decorations:
        main_washi_enabled = to_bool(
            decorations.get("main_washi_enabled"),
            default=False,
        )
        main_frame_enabled = to_bool(
            decorations.get("main_frame_enabled"),
            default=False,
        )
        cover_texture_enabled = to_bool(
            decorations.get("cover_texture_enabled"),
            default=False,
        )

        try:
            raw_variant = decorations.get("main_frame_variant")
            if raw_variant is not None:
                main_frame_variant = int(raw_variant)
        except (TypeError, ValueError):
            main_frame_variant = None

        try:
            raw_variant = decorations.get("cover_texture_variant")
            if raw_variant is not None:
                cover_texture_variant = int(raw_variant)
        except (TypeError, ValueError):
            cover_texture_variant = None

        raw_render_mode = str(
            decorations.get("background_render_mode") or ""
        ).strip().lower()
        if raw_render_mode in settings_store.SUPPORTED_BACKGROUND_RENDER_MODES:
            background_render_mode = raw_render_mode

        raw_cover_image_path = str(decorations.get("cover_image_path") or "").strip()
        if raw_cover_image_path:
            cover_image_path = raw_cover_image_path

        raw_washi_image_path = str(decorations.get("washi_image_path") or "").strip()
        if raw_washi_image_path:
            washi_image_path = raw_washi_image_path

        try:
            raw_cover_image_opacity = decorations.get("cover_image_opacity")
            if raw_cover_image_opacity is not None:
                cover_image_opacity = float(raw_cover_image_opacity)
        except (TypeError, ValueError):
            cover_image_opacity = None

        try:
            raw_washi_image_opacity = decorations.get("washi_image_opacity")
            if raw_washi_image_opacity is not None:
                washi_image_opacity = float(raw_washi_image_opacity)
        except (TypeError, ValueError):
            washi_image_opacity = None

        if "page_number_enabled" in decorations:
            page_number_enabled = to_bool(
                decorations.get("page_number_enabled"),
                default=True,
            )
        raw_body_column_mode = (
            str(decorations.get("body_column_mode") or "").strip().lower()
        )
        if raw_body_column_mode in settings_store.SUPPORTED_BODY_COLUMN_MODES:
            body_column_mode = raw_body_column_mode
        raw_device_orientation = (
            str(decorations.get("device_orientation") or "").strip().lower()
        )
        if raw_device_orientation in settings_store.SUPPORTED_ORIENTATIONS:
            device_orientation = raw_device_orientation

    if device not in BODY_COLUMN_OPTION_DEVICES:
        body_column_mode = "single_column"
    if device not in settings_store.DEVICE_ORIENTATION_OPTION_DEVICES:
        device_orientation = None

    try:
        generation = generate_tex_for_source(
            source_path=source_path,
            out_dir=work_dir,
            device=device,
            font_override=font_family,
            background_color=bg_color,
            text_color=fg_color,
            main_washi_enabled=main_washi_enabled,
            main_frame_enabled=main_frame_enabled,
            main_frame_variant=main_frame_variant,
            cover_texture_enabled=cover_texture_enabled,
            cover_texture_variant=cover_texture_variant,
            background_render_mode=background_render_mode,
            cover_image_path=cover_image_path,
            cover_image_opacity=cover_image_opacity,
            washi_image_path=washi_image_path,
            washi_image_opacity=washi_image_opacity,
            page_number_enabled=page_number_enabled,
            body_column_mode=body_column_mode,
            device_orientation=device_orientation,
        )
    except Exception as exc:
        logger.exception("src.aozoratex failed: %s", exc)
        return (
            False,
            {
                "error": f"Conversion failed: {exc}",
                "stdout": "",
                "stderr": str(exc),
            },
            500,
        )

    out_tex = generation.tex_file
    out_pdf_in_work = out_tex.with_suffix(".pdf")
    out_pdf_final = pdf_dir / out_pdf_in_work.name

    compile_log = ""
    if compile_pdf:
        if not out_tex.exists():
            logger.error("[generate] tex file missing: %s", out_tex)
            return False, {"error": f"Generated TEX not found: {out_tex.name}"}, 500

        compiled, compile_log = _run_latexmk(out_tex, work_dir, emit_log=emit_log)
        if not compiled:
            logger.error("[generate] latexmk failed for %s", source)
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
            logger.error(
                "[generate] pdf output missing after compile: %s", out_pdf_in_work
            )
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

    logger.info(
        "[generate] done source=%s tex=%s pdf=%s",
        source,
        out_tex.name,
        pdf_file or "(none)",
    )

    return (
        True,
        {
            "source": source,
            "tex_file": str(out_tex.relative_to(WORKDIR)),
            "pdf_file": pdf_file,
            "pdf_url": pdf_url,
            "font": font_family or "",
            "encoding": generation.encoding_used,
            "stdout": "",
            "stderr": "",
            "compile_log": compile_log,
        },
        200,
    )


# ---------------------------------------------------------------------------
# 青空文庫 作品インデックス（書籍検索・ダウンロード）
# ---------------------------------------------------------------------------

AOZORA_INDEX_URL = (
    "https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip"
)
AOZORA_INDEX_FILE = CACHE_DIR / "aozora_index.json"
AOZORA_USER_AGENT = "AozoraTeX-Studio/1.0"
AOZORA_ALLOWED_HOSTS = {"www.aozora.gr.jp", "aozora.gr.jp"}
# data/ 直下に保存するファイル名の許可パターン（パストラバーサル防止）
AOZORA_FILENAME_RE = re.compile(r"[0-9A-Za-z_\-]+\.x?html")
LIBRARY_SEARCH_LIMIT_MAX = 200
LIBRARY_DOWNLOAD_SLEEP_SEC = 1.0

# カタカナ→ひらがな変換テーブル（U+30A1〜U+30F6 を -0x60 シフト）
_KATAKANA_TO_HIRAGANA = {code: code - 0x60 for code in range(0x30A1, 0x30F7)}


def _http_get_bytes(url: str, timeout: float = 30.0) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": AOZORA_USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def _normalize_for_search(text: str) -> str:
    # NFKC 正規化 + 小文字化 + カタカナ→ひらがな + 空白除去。
    # 「作品名読み」(ひらがな) とカタカナ入力の双方にヒットさせるため。
    normalized = unicodedata.normalize("NFKC", text).lower()
    normalized = normalized.translate(_KATAKANA_TO_HIRAGANA)
    return "".join(normalized.split())


def _find_column(header: list[str], candidates: list[str]) -> Optional[int]:
    # 列名の表記ゆれに耐えるため、NFKC 正規化した完全一致 → 部分一致の順で探索
    normalized = [unicodedata.normalize("NFKC", name).strip() for name in header]
    for candidate in candidates:
        for index, name in enumerate(normalized):
            if name == candidate:
                return index
    for candidate in candidates:
        for index, name in enumerate(normalized):
            if candidate in name:
                return index
    return None


def _aozora_url_host_allowed(url: str) -> bool:
    try:
        host = urllib.parse.urlsplit(url).hostname
    except ValueError:
        return False
    return host in AOZORA_ALLOWED_HOSTS


def update_library_index() -> tuple[bool, dict]:
    try:
        raw_zip = _http_get_bytes(AOZORA_INDEX_URL)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.warning("Failed to download aozora index: %s", exc)
        return False, {
            "error": f"青空文庫サーバからインデックスを取得できませんでした: {exc}"
        }

    try:
        with zipfile.ZipFile(io.BytesIO(raw_zip)) as archive:
            # zip 内の CSV ファイル名変更に耐えるため名前非依存で探索
            csv_names = [
                name for name in archive.namelist() if name.lower().endswith(".csv")
            ]
            if not csv_names:
                return False, {"error": "インデックス zip に CSV が含まれていません。"}
            csv_text = archive.read(csv_names[0]).decode("utf-8-sig")
    except (zipfile.BadZipFile, UnicodeDecodeError) as exc:
        logger.warning("Failed to parse aozora index archive: %s", exc)
        return False, {"error": f"インデックスの解析に失敗しました: {exc}"}

    reader = csv.reader(io.StringIO(csv_text))
    header = next(reader, None)
    if not header:
        return False, {"error": "インデックス CSV が空です。"}

    columns = {
        "book_id": _find_column(header, ["作品ID"]),
        "title": _find_column(header, ["作品名"]),
        "title_reading": _find_column(header, ["作品名読み"]),
        "kana_type": _find_column(header, ["文字遣い種別"]),
        "role": _find_column(header, ["役割フラグ"]),
        "last_name": _find_column(header, ["姓"]),
        "first_name": _find_column(header, ["名"]),
        "last_name_reading": _find_column(header, ["姓読み"]),
        "first_name_reading": _find_column(header, ["名読み"]),
        "html_url": _find_column(header, ["XHTML/HTMLファイルURL"]),
    }
    missing = [
        key for key in ("book_id", "title", "html_url") if columns[key] is None
    ]
    if missing:
        return False, {
            "error": f"インデックス CSV に必須列が見つかりません: {', '.join(missing)}"
        }

    def cell(row: list[str], key: str) -> str:
        index = columns[key]
        if index is None or index >= len(row):
            return ""
        return row[index].strip()

    # CSV は (作品×人物) で 1 行のため、作品ID ごとに集約する。
    # 著者名は役割フラグ「著者」の行を優先し、無ければその他（翻訳者等）を使う。
    books: dict[str, dict] = {}
    for row in reader:
        book_id = cell(row, "book_id")
        html_url = cell(row, "html_url")
        if not book_id or not html_url:
            continue
        if not _aozora_url_host_allowed(html_url):
            continue
        filename = Path(urllib.parse.urlsplit(html_url).path).name
        if not AOZORA_FILENAME_RE.fullmatch(filename):
            continue

        entry = books.setdefault(
            book_id,
            {
                "book_id": book_id,
                "title": cell(row, "title"),
                "title_reading": cell(row, "title_reading"),
                "kana_type": cell(row, "kana_type"),
                "html_url": html_url,
                "filename": filename,
                "_authors": [],
                "_others": [],
            },
        )

        person = " ".join(
            part for part in (cell(row, "last_name"), cell(row, "first_name")) if part
        )
        reading = " ".join(
            part
            for part in (
                cell(row, "last_name_reading"),
                cell(row, "first_name_reading"),
            )
            if part
        )
        if person:
            bucket = entry["_authors"] if cell(row, "role") == "著者" else entry["_others"]
            if all(existing[0] != person for existing in bucket):
                bucket.append((person, reading))

    entries: list[dict] = []
    for entry in books.values():
        people = entry.pop("_authors") or entry.pop("_others")
        entry.pop("_others", None)
        entry["author"] = "、".join(name for name, _ in people)
        entry["author_reading"] = "、".join(reading for _, reading in people if reading)
        entry["norm"] = _normalize_for_search(
            "|".join(
                (
                    entry["title"],
                    entry["title_reading"],
                    entry["author"],
                    entry["author_reading"],
                )
            )
        )
        entries.append(entry)
    entries.sort(key=lambda e: int(e["book_id"]) if e["book_id"].isdigit() else 0)

    updated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    payload = {
        "meta": {
            "updated_at": updated_at,
            "total": len(entries),
            "source_url": AOZORA_INDEX_URL,
        },
        "books": entries,
    }

    # 一時ファイル→replace のアトミック更新（失敗時に旧キャッシュを壊さない）
    _safe_mkdir(CACHE_DIR)
    tmp_file = AOZORA_INDEX_FILE.with_name(AOZORA_INDEX_FILE.name + ".tmp")
    tmp_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    tmp_file.replace(AOZORA_INDEX_FILE)

    logger.info("[library] index updated: total=%s", len(entries))
    return True, {"total": len(entries), "updated_at": updated_at}


def _load_library_index() -> Optional[dict]:
    try:
        return json.loads(AOZORA_INDEX_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except Exception as exc:
        logger.warning("Failed to load library index cache: %s", exc)
        return None


def get_library_status() -> dict:
    index = _load_library_index()
    if index is None:
        return {"cached": False, "updated_at": None, "total": 0}
    meta = index.get("meta", {})
    return {
        "cached": True,
        "updated_at": meta.get("updated_at"),
        "total": meta.get("total", len(index.get("books", []))),
    }


def search_library(query: str, offset: int = 0, limit: int = 50) -> tuple[bool, dict]:
    index = _load_library_index()
    if index is None:
        return False, {
            "error": "index_not_ready",
            "message": "作品インデックスが未取得です。先にインデックスを更新してください。",
        }

    books = index.get("books", [])
    terms = [
        term
        for term in (_normalize_for_search(part) for part in str(query or "").split())
        if term
    ]
    if terms:
        matched = [
            book
            for book in books
            if all(term in book.get("norm", "") for term in terms)
        ]
    else:
        matched = books

    offset = max(0, int(offset))
    limit = min(max(1, int(limit)), LIBRARY_SEARCH_LIMIT_MAX)
    items = []
    for book in matched[offset : offset + limit]:
        item = {key: value for key, value in book.items() if key != "norm"}
        item["downloaded"] = (DATA_DIR / book["filename"]).exists()
        item["path"] = str((DATA_DIR / book["filename"]).relative_to(WORKDIR))
        parsed_html_url = urllib.parse.urlsplit(str(book.get("html_url", "")))
        card_dir = str(Path(parsed_html_url.path).parent.parent).replace("\\", "/")
        item["card_url"] = urllib.parse.urlunsplit(
            (
                parsed_html_url.scheme,
                parsed_html_url.netloc,
                f"{card_dir}/card{int(book['book_id'])}.html",
                "",
                "",
            )
        )
        items.append(item)

    return True, {"total": len(matched), "offset": offset, "limit": limit, "items": items}


def download_library_books(
    book_ids: list[str],
    overwrite: bool = False,
    sleep_sec: float = LIBRARY_DOWNLOAD_SLEEP_SEC,
    emit_log: Optional[callable] = None,
) -> tuple[bool, dict]:
    index = _load_library_index()
    if index is None:
        return False, {
            "error": "作品インデックスが未取得です。先にインデックスを更新してください。"
        }

    def log(line: str) -> None:
        if emit_log:
            emit_log(line)

    # クライアントから URL は受け取らず、作品ID からインデックス経由で解決する
    # （SSRF・パストラバーサル防止。_resolve_source_path と同じ「サーバ側で閉じる」方針）
    books_by_id = {book["book_id"]: book for book in index.get("books", [])}
    _safe_mkdir(DATA_DIR)

    results: list[dict] = []
    counts = {"downloaded": 0, "skipped": 0, "failed": 0}
    did_request = False
    total = len(book_ids)

    for position, raw_id in enumerate(book_ids, start=1):
        prefix = f"[{position}/{total}]"
        book_id = str(raw_id).strip()
        book = books_by_id.get(book_id)
        if not book:
            log(f"{prefix} 作品ID {book_id} はインデックスに存在しません。")
            counts["failed"] += 1
            results.append(
                {
                    "book_id": book_id,
                    "status": "failed",
                    "error": "インデックスに存在しない作品IDです。",
                }
            )
            continue

        filename = book["filename"]
        target = DATA_DIR / filename
        result = {
            "book_id": book_id,
            "title": book["title"],
            "filename": filename,
            "path": str(target.relative_to(WORKDIR)),
        }

        if (
            not AOZORA_FILENAME_RE.fullmatch(filename)
            or not _aozora_url_host_allowed(book["html_url"])
        ):
            log(f"{prefix} {book['title']} は不正なファイル名/URLのためスキップします。")
            result["status"] = "failed"
            result["error"] = "不正なファイル名または URL です。"
            counts["failed"] += 1
            results.append(result)
            continue

        if target.exists() and not overwrite:
            log(f"{prefix} {book['title']} ({filename}) は既に存在するためスキップします。")
            result["status"] = "skipped"
            counts["skipped"] += 1
            results.append(result)
            continue

        try:
            # 青空文庫サーバへの配慮として、連続リクエスト間にスリープを挟む
            if did_request and sleep_sec > 0:
                time.sleep(sleep_sec)
            log(f"{prefix} {book['title']} ({filename}) をダウンロード中...")
            data = _http_get_bytes(book["html_url"])
            did_request = True
            # 原本バイト列のまま保存（エンコーディング判定は既存パイプラインが行う）
            tmp_file = target.with_name(target.name + ".tmp")
            tmp_file.write_bytes(data)
            tmp_file.replace(target)
            log(f"{prefix} {book['title']} を保存しました → {result['path']}")
            result["status"] = "downloaded"
            counts["downloaded"] += 1
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            did_request = True
            logger.warning("[library] download failed for %s: %s", book_id, exc)
            log(f"{prefix} {book['title']} のダウンロードに失敗しました: {exc}")
            result["status"] = "failed"
            result["error"] = str(exc)
            counts["failed"] += 1
        results.append(result)

    ok = counts["failed"] < total if total else False
    payload = {"results": results, **counts}
    if not ok:
        payload["error"] = "すべての作品のダウンロードに失敗しました。"
    return ok, payload


# ---------------------------------------------------------------------------
# 設定ファイルを外部エディタで開く
# ---------------------------------------------------------------------------

# UI から指定できるエディタ識別子（開くパスはサーバー側で固定）
SUPPORTED_CONFIG_EDITORS = ("default", "notepad", "vscode", "explorer")


def open_device_default_file(app: str) -> tuple[bool, dict[str, str]]:
    """デバイス初期値ファイル（device_settings.default.ini）を外部アプリで開く。

    app:
        default  - OS の関連付けアプリ（既定のエディタ）
        notepad  - メモ帳（Windows のみ）
        vscode   - Visual Studio Code（PATH 上の code コマンド）
        explorer - エクスプローラー / Finder でファイルの場所を表示
    """
    settings_store.ensure_config_files()
    path = settings_store.DEVICE_DEFAULT_FILE
    normalized_app = (app or "default").strip().lower()
    if normalized_app not in SUPPORTED_CONFIG_EDITORS:
        return False, {"error": f"未対応のエディタ指定です: {app}"}

    try:
        if normalized_app == "notepad":
            if sys.platform != "win32":
                return False, {"error": "メモ帳は Windows でのみ利用できます。"}
            subprocess.Popen(["notepad.exe", str(path)])
        elif normalized_app == "vscode":
            code_cmd = shutil.which("code") or shutil.which("code.cmd")
            if not code_cmd:
                return False, {
                    "error": (
                        "VS Code の code コマンドが見つかりません。"
                        "VS Code をインストールし PATH に code を追加してください。"
                    )
                }
            subprocess.Popen([code_cmd, str(path)])
        elif normalized_app == "explorer":
            if sys.platform == "win32":
                subprocess.Popen(["explorer", f"/select,{path}"])
            elif sys.platform == "darwin":
                subprocess.Popen(["open", "-R", str(path)])
            else:
                subprocess.Popen(["xdg-open", str(path.parent)])
        else:  # default: OS の関連付けアプリ
            if sys.platform == "win32":
                os.startfile(str(path))  # noqa: S606 - 固定パスのみを開く
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(path)])
            else:
                subprocess.Popen(["xdg-open", str(path)])
    except OSError as exc:
        logger.warning("[config] failed to open editor %s: %s", normalized_app, exc)
        return False, {"error": f"エディタの起動に失敗しました: {exc}"}

    return True, {"app": normalized_app, "path": str(path)}
