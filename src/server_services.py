from __future__ import annotations

import csv
import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Optional

from src import settings_store
from src.aozoratex_generate import generate_tex_for_source

WORKDIR = Path(__file__).resolve().parent.parent
DATA_DIR = WORKDIR / "data"
OUT_DIR = WORKDIR / "out"
WORK_OUT_DIR = OUT_DIR / "work"
PDF_OUT_DIR = OUT_DIR / "pdf"
LEGACY_SESSION_DIR = OUT_DIR / "session"
STATIC_DIR = WORKDIR / "static"
COLOR_PALETTE_FILE = STATIC_DIR / "color-palettes.json"
FONT_LIST_ENTRY = WORKDIR / "tools" / "fonts" / "texlive_font_list.py"
FONT_LIST_CSV = WORKDIR / "tools" / "fonts" / "texlive_fonts.csv"
MAX_COLOR_SCHEMES = 36

_FONT_CACHE_MTIME: Optional[float] = None
_FONT_CACHE_FONTS: list[dict] = []
_FONT_CACHE_META: dict[str, object] = {}

logger = logging.getLogger(__name__)


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
        key=lambda item: (0 if item["recommended"] else 1, item["display_name"].lower())
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


def resolve_decoration_options(payload: dict) -> dict[str, object]:
    global_settings = settings_store.get_global_settings()

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

    main_washi_default = to_bool(
        global_settings.get("main_washi_enabled"),
        default=False,
    )

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
        "page_number_enabled": pick_bool(
            "page_number_enabled",
            to_bool(global_settings.get("page_number_enabled"), default=True),
        ),
        "two_column_enabled": pick_bool(
            "two_column_enabled",
            to_bool(global_settings.get("two_column_enabled"), default=False),
        ),
    }


def save_generation_preferences(
    device: str,
    mode: str,
    bg_color: str,
    fg_color: str,
    font_family: Optional[str] = None,
    decorations: Optional[dict[str, object]] = None,
) -> None:
    global_updates: dict[str, object] = {
        "color_mode": mode,
        "background_color": bg_color,
        "text_color": fg_color,
        f"background_color_{mode}": bg_color,
        f"text_color_{mode}": fg_color,
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
            "page_number_enabled",
            "two_column_enabled",
        ):
            if key in decorations:
                global_updates[key] = decorations[key]

    settings_store.save_settings(
        {
            "global": global_updates,
            "devices": {device: {"color_mode": mode}},
        }
    )


def list_source_files() -> list[dict]:
    html_files = list(DATA_DIR.glob("*.html")) + list(DATA_DIR.glob("*.xhtml"))
    return [
        {"name": f.name, "path": str(f.relative_to(WORKDIR))}
        for f in sorted(html_files)
    ]


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


def _run_latexmk(tex_file: Path, output_dir: Path, emit_log: Optional[callable] = None) -> tuple[bool, str]:
    latexmk_bin = shutil.which("latexmk")
    if not latexmk_bin:
        msg = "latexmk が見つかりません。TeX Live の PATH 設定を確認してください。"
        if emit_log:
            emit_log(msg + "\n")
        return False, msg

    cmd = [
        latexmk_bin,
        "-lualatex",
        "-interaction=nonstopmode",
        "-file-line-error",
        "-halt-on-error",
        "-silent",
        "-use-make",
        "-outdir=" + str(output_dir),
        "-auxdir=" + str(output_dir),
        str(tex_file),
    ]
    logger.info("[latexmk] command: %s", command_to_log_text(cmd))
    
    if emit_log:
        emit_log(f"$ {command_to_log_text(cmd)}\n")

    try:
        proc = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            encoding="utf-8", 
            errors="replace", 
            cwd=WORKDIR,
            bufsize=1  # line buffered
        )
    except OSError as exc:
        msg = f"latexmk failed to start: {exc}"
        if emit_log:
            emit_log(msg + "\n")
        return False, msg

    outputs = []
    if proc.stdout is not None:
        for line in iter(proc.stdout.readline, ""):
            outputs.append(line)
            if emit_log:
                emit_log(line)
    
    try:
        proc.wait(timeout=180)
    except subprocess.TimeoutExpired:
        proc.kill()
        msg = "latexmk timeout (180s)"
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
    mode: str,
    bg_color: str,
    fg_color: str,
    font_family: Optional[str],
    compile_pdf: bool,
    decorations: Optional[dict[str, object]] = None,
    emit_log: Optional[callable] = None,
) -> tuple[bool, dict, int]:
    logger.info(
        "[generate] start source=%s device=%s mode=%s compile_pdf=%s",
        source,
        device,
        mode,
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
    page_number_enabled: Optional[bool] = None

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

        if "page_number_enabled" in decorations:
            page_number_enabled = to_bool(
                decorations.get("page_number_enabled"),
                default=True,
            )

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
            page_number_enabled=page_number_enabled,
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
            "mode": mode,
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
