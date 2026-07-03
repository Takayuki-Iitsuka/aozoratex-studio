#!/usr/bin/env python3
"""
aozoratex.py

青空文庫の HTML/XHTML（ローカルファイル）を読み込み、LuaLaTeX で縦書き PDF を作るための
`.tex` を生成するスクリプトです。PDF のコンパイル（lualatex 実行）は行いません。

初心者向けに全体像:

- 入力: 青空文庫の HTML / XHTML（ルビや見出しなどの情報が HTML に含まれる）
- 変換: BeautifulSoup で HTML をパースし、本文部分のノードを走査して LaTeX 命令へ写像する
- 出力: `jlreq(tate)` + `luatexja` を前提にしたテンプレートへ本文を埋めて `.tex` を出力する

このリポジトリの想定:
- Windows 上での実行を想定（パス区切りや cp932 の存在を考慮）
- 入力はローカルファイルのみ（URL 取得はしない）

注意: 本ファイルは変換コア。Web/CLI は api_bridge / server_services / aozoratex_cli を経由してください。
"""

# ---- 標準ライブラリ ----
import argparse
import logging
import math
import re
import shutil
import subprocess
import sys
import warnings
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Optional

# ---- サードパーティ ----
from bs4 import BeautifulSoup, Tag, XMLParsedAsHTMLWarning
from bs4.element import NavigableString

from src import settings_store

try:
    from fontTools import ttLib

    HAS_FONTTOOLS = True
except ImportError:
    HAS_FONTTOOLS = False

# ---- 定数 ----
WORKDIR = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = WORKDIR / "src" / "templates"
WASHI_LUA_TEMPLATE_FILE = TEMPLATE_DIR / "washi_texture.lua"
JIGMO_COVERAGE_LUA_FILE = TEMPLATE_DIR / "jigmo_coverage.lua"
ASSETS_DIR = WORKDIR / "assets"
BACKGROUND_ASSET_DIRS: dict[str, Path] = {
    "cover": ASSETS_DIR / "cover",
    "washi": ASSETS_DIR / "washi",
}
BACKGROUND_ASSET_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
DEFAULT_COVER_IMAGE_OPACITY = 0.92
DEFAULT_WASHI_IMAGE_OPACITY = 0.18


def _normalize_background_render_mode(
    value: Optional[str], fallback: str = "tikz"
) -> str:
    mode = str(value or "").strip().lower()
    if mode in settings_store.SUPPORTED_BACKGROUND_RENDER_MODES:
        return mode
    return fallback


def _normalize_background_opacity(value: object, fallback: float) -> float:
    try:
        opacity = float(value)
    except (TypeError, ValueError):
        opacity = fallback
    return min(1.0, max(0.0, opacity))


def _list_background_asset_paths(kind: str) -> list[Path]:
    asset_dir = BACKGROUND_ASSET_DIRS.get(kind)
    if asset_dir is None or not asset_dir.exists():
        return []
    files = [
        path
        for path in asset_dir.iterdir()
        if path.is_file() and path.suffix.lower() in BACKGROUND_ASSET_EXTENSIONS
    ]
    return sorted(files, key=lambda path: (-path.stat().st_mtime, path.name.lower()))


def _to_project_relative_posix(path: Path) -> str:
    try:
        return path.resolve().relative_to(WORKDIR.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def list_background_assets(kind: str) -> list[dict[str, str]]:
    return [
        {"name": path.name, "path": _to_project_relative_posix(path)}
        for path in _list_background_asset_paths(kind)
    ]


def get_default_background_assets() -> dict[str, str]:
    defaults: dict[str, str] = {"cover": "", "washi": ""}
    for kind in defaults:
        paths = _list_background_asset_paths(kind)
        if paths:
            defaults[kind] = _to_project_relative_posix(paths[0])
    return defaults


def _resolve_background_asset_path(
    kind: str, configured_path: Optional[str]
) -> Optional[Path]:
    candidate_paths = _list_background_asset_paths(kind)
    if configured_path:
        raw = str(configured_path).strip().replace("\\", "/")
        candidate = Path(raw)
        if not candidate.is_absolute():
            candidate = (WORKDIR / candidate).resolve()
        else:
            candidate = candidate.resolve()
        if candidate.exists() and candidate.is_file():
            return candidate
    if candidate_paths:
        return candidate_paths[0]
    return None


def _stage_background_image(source_path: Path, out_tex: Path, slot: str) -> str:
    staged_dir = out_tex.parent / "_backgrounds"
    staged_dir.mkdir(parents=True, exist_ok=True)
    extension = source_path.suffix.lower() or ".img"
    staged_path = staged_dir / f"{slot}{extension}"
    shutil.copy2(source_path, staged_path)
    return staged_path.relative_to(out_tex.parent).as_posix()


def _load_washi_lua_template() -> str:
    if not WASHI_LUA_TEMPLATE_FILE.exists():
        raise FileNotFoundError(
            f"Washi Lua template not found: {WASHI_LUA_TEMPLATE_FILE}"
        )
    return WASHI_LUA_TEMPLATE_FILE.read_text(encoding="utf-8").strip()


def _load_jigmo_coverage_lua() -> str:
    """
    jigmo の Unicode カバレッジ確認 Lua スクリプトを読み込む。

    テンプレート欠落時はコンパイルを壊さないよう no-op を返す。
    """
    if not JIGMO_COVERAGE_LUA_FILE.exists():
        return "jigmo_select = nil"

    raw = JIGMO_COVERAGE_LUA_FILE.read_text(encoding="utf-8")

    # \directlua{...} に Lua ソースを直埋めすると、改行が空白として扱われる。
    # そのため `--` 行コメントが行末で終わらず、後続コード全体をコメント化し得る。
    # 直埋め用にはコメント行を丸ごと除去して安全化する。
    #
    # 併せて、コメント行に含まれる TeX 制御綴（\foo）展開事故も回避できる。
    sanitized_lines: list[str] = []
    for line in raw.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("--"):
            continue
        else:
            sanitized_lines.append(line)
    return "\n".join(sanitized_lines).strip()


JIGMO_COVERAGE_LUA = _load_jigmo_coverage_lua()
JIGMO_COVERAGE_LUA_FOR_PERCENT_TEMPLATE = JIGMO_COVERAGE_LUA.replace("%", "%%")


WASHI_TEXTURE_TEMPLATE = (
    r"""% washi texture snippet (overlay-ready)
% section={{section_label}}

\definecolor{wBase}  {HTML}{{{base_bg_hex}}}
\definecolor{wLight} {RGB}{236,224,197}
\definecolor{wDark}  {RGB}{205,190,158}
\definecolor{wF1}    {RGB}{176,160,128}
\definecolor{wF2}    {RGB}{192,176,145}
\definecolor{wF3}    {RGB}{161,143,109}
\definecolor{wSpeck} {RGB}{137,119, 87}
\definecolor{wBark}  {RGB}{80, 65, 45}

\directlua{
"""
    + _load_washi_lua_template()
    + r"""
}
"""
)

COVER_TEXTURE_TEMPLATES: dict[int, str] = {
    1: r"""\fill[fill={rgb,255:red,246;green,229;blue,204},opacity=0.38]
    (current page.south west) rectangle (current page.north east);
\begin{scope}[opacity=0.14]
    \foreach \x in {0,2,...,20} {
        \foreach \y in {0,2,4} {
            \fill[blue!45!black]
                ($(current page.north west)+(\x*5mm,-\y*5mm)$) rectangle ++(5mm,-5mm);
            \fill[blue!45!black]
                ($(current page.north west)+(\x*5mm+5mm,-\y*5mm-5mm)$) rectangle ++(5mm,-5mm);
            \fill[blue!45!black]
                ($(current page.south west)+(\x*5mm,\y*5mm)$) rectangle ++(5mm,5mm);
            \fill[blue!45!black]
                ($(current page.south west)+(\x*5mm+5mm,\y*5mm+5mm)$) rectangle ++(5mm,5mm);
        }
    }
\end{scope}
\draw[line width=1.2pt, color=blue!65!black]
    ($(current page.south west)+(6mm,6mm)$)
    rectangle
    ($(current page.north east)-(6mm,6mm)$);
\draw[line width=0.3pt, color=blue!65!black]
    ($(current page.south west)+(7.5mm,7.5mm)$)
    rectangle
    ($(current page.north east)-(7.5mm,7.5mm)$);""",
    2: r"""\begin{scope}[opacity=0.25, color=black!80, very thin]
    \foreach \angle in {0,10,...,350} {
        \draw (current page.center) -- ++(\angle:130mm);
    }
\end{scope}
\begin{scope}[opacity=0.30, color=black!80, very thin]
    \foreach \s in {1,...,9} {
        \draw ($(current page.center)-(\s*4.5mm,\s*8mm)$)
            rectangle
            ($(current page.center)+(\s*4.5mm,\s*8mm)$);
    }
\end{scope}
\draw[line width=1.2pt, color=black!75]
    ($(current page.south west)+(6mm,6mm)$)
    rectangle
    ($(current page.north east)-(6mm,6mm)$);
\draw[line width=0.3pt, color=black!75]
    ($(current page.south west)+(7.5mm,7.5mm)$)
    rectangle
    ($(current page.north east)-(7.5mm,7.5mm)$);""",
    3: r"""\fill[fill={rgb,255:red,244;green,241;blue,234},opacity=0.45]
    (current page.south west) rectangle (current page.north east);
\begin{scope}[opacity=0.40, line width=0.8pt]
    \foreach \r in {1,3,...,15} {
        \draw[teal!55!black]
            ($(current page.south west)+(10mm,15mm)$) circle (\r*7mm);
    }
    \foreach \r in {2,4,...,18} {
        \draw[red!45!black]
            ($(current page.north east)+(-15mm,-10mm)$) circle (\r*8mm);
    }
\end{scope}
\draw[line width=1.2pt, color=black!70]
    ($(current page.south west)+(6mm,6mm)$)
    rectangle
    ($(current page.north east)-(6mm,6mm)$);
\draw[line width=0.3pt, color=black!70]
    ($(current page.south west)+(7.5mm,7.5mm)$)
    rectangle
    ($(current page.north east)-(7.5mm,7.5mm)$);""",
}

MAIN_FRAME_TEMPLATES: dict[int, str] = {
    1: r"""\def\mg{4mm}
\draw[line width=0.5pt]
    ([xshift=\mg, yshift=-\mg]current page.north west)
    rectangle
    ([xshift=-\mg, yshift=\mg]current page.south east);
\tikzset{dia/.style={rotate=45, minimum size=5pt, fill=black, inner sep=0pt}}
\node[dia] at ([xshift=\mg,  yshift=-\mg]current page.north west) {};
\node[dia] at ([xshift=-\mg, yshift=-\mg]current page.north east) {};
\node[dia] at ([xshift=\mg,  yshift=\mg] current page.south west) {};
\node[dia] at ([xshift=-\mg, yshift=\mg] current page.south east) {};""",
    2: r"""\definecolor{frameboard}{RGB}{205,133,63}
\draw[line width=1.5pt, color=frameboard]
    ([xshift=4mm, yshift=-4mm]current page.north west)
    rectangle
    ([xshift=-4mm, yshift=4mm]current page.south east);
\draw[line width=0.3pt, color=frameboard]
    ([xshift=4.4mm, yshift=-4.4mm]current page.north west)
    rectangle
    ([xshift=-4.4mm, yshift=4.4mm]current page.south east);""",
    3: r"""\definecolor{shide}{HTML}{B22222}
\draw[line width=0.4pt, gray!50]
    ($(current page.north west)+(4mm,-4mm)$)
    rectangle
    ($(current page.south east)+(-4mm,4mm)$);
\draw[line width=1.2pt, shide]
    ($(current page.north west)+(1cm,-3cm)$)
    -- ($(current page.north west)+(1cm,-1.5cm)$)
    -- ($(current page.north west)+(1.5cm,-1.5cm)$)
    -- ($(current page.north west)+(1.5cm,-1cm)$)
    -- ($(current page.north west)+(3cm,-1cm)$);
\draw[line width=1.2pt, shide]
    ($(current page.south east)+(-1cm,3cm)$)
    -- ($(current page.south east)+(-1cm,1.5cm)$)
    -- ($(current page.south east)+(-1.5cm,1.5cm)$)
    -- ($(current page.south east)+(-1.5cm,1cm)$)
    -- ($(current page.south east)+(-3cm,1cm)$);""",
}

# よく使う青空外字注記のうち、Unicode へ安全に置換できるもの
GAIJI_ALT_TO_UNICODE: dict[str, str] = {
    "特のへん＋廴＋聿": "犍",
    # ---- JIS第3水準・第4水準の面区点表記（最も安全で確実） ----
    "第3水準1-14-21": "俱",
    "第3水準1-14-41": "剝",
    "第3水準1-14-72": "頰",
    "第3水準1-15-34": "吞",
    "第3水準1-15-46": "噓",
    "第3水準1-15-75": "𠮟",
    "第3水準1-16-05": "塡",
    "第3水準1-47-52": "麵",
    "第3水準1-47-68": "橢",
    "第3水準1-47-75": "鷗",
    "第3水準1-83-25": "攪",
    "第3水準1-84-77": "𠮷",
    "第3水準1-85-05": "捩",
    "第3水準1-86-30": "撚",
    "第3水準1-86-64": "驒",
    "第3水準1-93-22": "礒",
    "第3水準1-93-61": "鐚",
    "第3水準1-94-71": "𩸽",
    "第4水準2-14-21": "壺",
    "第4水準2-14-69": "搔",
    "第4水準2-82-74": "顛",
    "第4水準2-85-23": "醬",
    "第4水準2-94-68": "鹼",
    # ---- 面区点がない古い注記向けの部品表記 ----
    "土／口": "𠮷",
    "口＋七": "𠮟",
    "金＋惡": "鐚",
    "人べん＋具": "俱",
    "天／口": "吞",
    "口＋虚": "噓",
    "天／水": "剝",
    "夾／肉": "頰",
    "麥＋面": "麵",
    "鳥＋區": "鷗",
    "魚＋單": "𩸽",
    # ---- 面区点がない古い注記向けの部品表記（新規） ----
    "てへん＋劣": "捩",
    "つちへん＋眞": "塡",
    "てへん＋覺": "攪",
    "かぜへん＋臺": "颱",
    "木＋眞": "榛",
    "しめすへん＋爾": "禰",
    "おおがい＋眞": "顛",
    "糸へん＋戀": "孌",
}


class JigmoCoverageDB:
    """
    jigmo / jigmo2 / jigmo3 の Unicode カバレッジを判定する軽量 DB。

    - fonttools が利用可能な場合: 実フォント cmap から厳密に判定
    - 利用不可の場合: 代表的な Unicode ブロックで近似判定
    """

    FONT_ORDER = ("jigmo", "jigmo2", "jigmo3")
    EXTENSIONS = (".otf", ".ttf")

    def __init__(self) -> None:
        self.coverage: dict[str, set[int]] = {}
        self._build()

    def _kpsewhich(self, name: str) -> Optional[str]:
        for ext in self.EXTENSIONS:
            try:
                proc = subprocess.run(
                    ["kpsewhich", name + ext],
                    capture_output=True,
                    text=True,
                    timeout=8,
                )
            except (FileNotFoundError, subprocess.TimeoutExpired):
                continue
            path = proc.stdout.strip()
            if path and Path(path).exists():
                return path
        return None

    def _build(self) -> None:
        if HAS_FONTTOOLS:
            self._build_from_fonts()
        else:
            self._build_fallback()

    def _build_from_fonts(self) -> None:
        for name in self.FONT_ORDER:
            path = self._kpsewhich(name)
            if not path:
                self.coverage[name] = set()
                continue

            try:
                tt = ttLib.TTFont(path, lazy=True)
                cmap = tt.getBestCmap()
                self.coverage[name] = set(cmap.keys()) if cmap else set()
                tt.close()
            except Exception:
                self.coverage[name] = set()

        if all(len(v) == 0 for v in self.coverage.values()):
            self._build_fallback()

    def _build_fallback(self) -> None:
        def flatten(ranges: Iterable[range]) -> set[int]:
            out: set[int] = set()
            for r in ranges:
                out.update(r)
            return out

        self.coverage["jigmo"] = flatten(
            (
                range(0x3400, 0x4DC0),  # CJK Unified Ideographs Extension A
                range(0xF900, 0xFAD0),  # CJK Compatibility Ideographs
                range(0x2E80, 0x2FE0),  # CJK Radicals / Kangxi
            )
        )
        self.coverage["jigmo2"] = flatten((range(0x4E00, 0xA000),))
        self.coverage["jigmo3"] = flatten(
            (
                range(0x20000, 0x2A6E0),  # CJK Unified Ideographs Extension B
                range(0x2A700, 0x2CEB0),  # CJK Unified Ideographs Extension C/D
            )
        )

    def select(self, codepoint: int) -> Optional[str]:
        for name in self.FONT_ORDER:
            if codepoint in self.coverage.get(name, set()):
                return name
        return None


_JIGMO_DB: Optional[JigmoCoverageDB] = None


def _get_jigmo_db() -> JigmoCoverageDB:
    global _JIGMO_DB
    if _JIGMO_DB is None:
        _JIGMO_DB = JigmoCoverageDB()
    return _JIGMO_DB


@lru_cache(maxsize=2048)
def _jisx0213_to_unicode(plane: int, ku: int, ten: int) -> Optional[str]:
    """
    JIS X 0213 の面区点を Unicode へ変換する。
    """
    if not (plane in (1, 2) and 1 <= ku <= 94 and 1 <= ten <= 94):
        return None

    b1 = 0xA0 + ku
    b2 = 0xA0 + ten
    if plane == 1:
        raw = bytes([b1, b2])
        codecs = ("euc_jis_2004", "euc_jisx0213", "euc-jis-2004")
    else:
        raw = bytes([0x8F, b1, b2])
        codecs = ("euc_jis_2004", "euc-jis-2004")

    for codec in codecs:
        try:
            return raw.decode(codec)
        except (LookupError, UnicodeDecodeError):
            continue
    return None


def _parse_gaiji_src(src: str) -> Optional[tuple[int, int, int]]:
    normalized_src = (src or "").strip()
    if not normalized_src:
        return None

    # URL クエリ/フラグメントは解析対象から除外
    normalized_src = normalized_src.split("?", 1)[0].split("#", 1)[0]

    patterns = (
        r"gaiji/(\d+)-(\d+)/\1-\2-(\d+)\.(?:png|gif|jpe?g)",
        r"gaiji/(\d+)-(\d+)-(\d+)\.(?:png|gif|jpe?g)",
    )
    for pattern in patterns:
        m = re.search(pattern, normalized_src, flags=re.IGNORECASE)
        if not m:
            continue
        plane = int(m.group(1))
        ku = int(m.group(2))
        ten = int(m.group(3))
        if plane in (1, 2) and 1 <= ku <= 94 and 1 <= ten <= 94:
            return plane, ku, ten
    return None


_GAIJI_ALT_CODE_TRANSLATE = str.maketrans(
    "０１２３４５６７８９－ー−―‐",
    "0123456789-----",
)


def _parse_gaiji_alt_code(alt: str) -> Optional[tuple[int, int, int]]:
    normalized = (alt or "").strip()
    if not normalized:
        return None

    normalized = normalized.translate(_GAIJI_ALT_CODE_TRANSLATE)
    patterns = (
        r"第\d水準([12])-(\d+)-(\d+)",
        r"[（(]\s*([12])-(\d+)-(\d+)\s*[)）]",
        r"\b([12])-(\d+)-(\d+)\b",
    )
    for pattern in patterns:
        m = re.search(pattern, normalized)
        if not m:
            continue
        plane = int(m.group(1))
        ku = int(m.group(2))
        ten = int(m.group(3))
        if plane in (1, 2) and 1 <= ku <= 94 and 1 <= ten <= 94:
            return plane, ku, ten
    return None


def _codepoint_text_to_char(codepoint_text: str) -> Optional[str]:
    m = re.search(r"([0-9A-Fa-f]{4,6})", codepoint_text or "")
    if not m:
        return None
    try:
        return chr(int(m.group(1), 16))
    except ValueError:
        return None


def _build_gaiji_tooltip_payload(
    src: str,
    alt: str,
    html_fragment: str,
    unicode_char: Optional[str],
) -> str:
    compact_html = re.sub(r"\s+", " ", (html_fragment or "").strip())
    parts = [
        f"src={src or '(none)'}",
        f"alt={alt or '(none)'}",
    ]
    if unicode_char:
        parts.append(f"unicode=U+{ord(unicode_char):04X} {unicode_char}")
    if compact_html:
        parts.append(f"html={compact_html}")
    text = " | ".join(parts)
    if len(text) > 260:
        text = text[:259] + "…"
    return text


def _build_gaiji_unknown_label(src: str, alt: str) -> str:
    code = _parse_gaiji_src(src) or _parse_gaiji_alt_code(alt)
    if code:
        plane, row, cell = code
        return f"{plane}-{row:02d}-{cell:02d}"

    codepoint_text = _extract_gaiji_codepoint_text(alt)
    if codepoint_text:
        return codepoint_text.upper()

    alt_compact = re.sub(r"\s+", " ", (alt or "").strip())
    if alt_compact:
        return alt_compact[:20] + ("…" if len(alt_compact) > 20 else "")

    src_name = Path(src).name if src else ""
    if src_name:
        return src_name[:20] + ("…" if len(src_name) > 20 else "")

    return "unknown"


def _resolve_gaiji_unicode(src: str, alt: str) -> Optional[str]:
    code = _parse_gaiji_src(src) or _parse_gaiji_alt_code(alt)
    if code:
        char = _jisx0213_to_unicode(*code)
        if char:
            return char

    mapped = _gaiji_alt_to_unicode(alt)
    if mapped:
        return mapped

    codepoint_text = _extract_gaiji_codepoint_text(alt)
    if codepoint_text:
        codepoint_char = _codepoint_text_to_char(codepoint_text)
        if codepoint_char:
            return codepoint_char
    return None


# -----------------------
# 設定ファイル読み込み
# -----------------------

# JIS X 4051「基本版面の設計」に合わせた組版係数（ini では持たず、コードで保持する）
JIS_SOLID_CHARACTER_SPACING_ZW = 0.0
JIS_CHARACTER_PITCH_ZW = 1.0
JIS_LINE_GAP_RATIO_MIN = 0.5
JIS_LINE_GAP_RATIO_MAX = 1.0
JIS_DEFAULT_LINE_GAP_RATIO = 0.5
JIS_PARAGRAPH_INDENT_ZW = 1.0
PT_TO_MM = 0.35278


def _compute_jis_typesetting_metrics(
    font_size: float,
    *,
    line_gap_ratio_override: Optional[float] = None,
    line_leading_ratio_override: Optional[float] = None,
    character_spacing_zw_override: Optional[float] = None,
) -> dict[str, float]:
    """
    フォントサイズ S から JIS X 4051 準拠の組版値を計算する。

    - Character spacing = 0（ベタ組み）
    - Character pitch = 1zw
    - Line gap = k * S（k は 0.5〜1.0、既定は 0.5）
    - Line leading = S + Line gap = (1 + k) * S
    """
    safe_font_size = max(0.1, float(font_size))
    line_gap_ratio = JIS_DEFAULT_LINE_GAP_RATIO
    if line_gap_ratio_override is not None:
        line_gap_ratio = float(line_gap_ratio_override)
    line_gap_ratio = min(max(line_gap_ratio, JIS_LINE_GAP_RATIO_MIN), JIS_LINE_GAP_RATIO_MAX)

    if line_leading_ratio_override is not None:
        line_leading_ratio = max(0.8, float(line_leading_ratio_override))
        line_gap_ratio = max(0.0, line_leading_ratio - 1.0)
    else:
        line_leading_ratio = 1.0 + line_gap_ratio

    character_spacing_zw = JIS_SOLID_CHARACTER_SPACING_ZW
    if character_spacing_zw_override is not None:
        character_spacing_zw = float(character_spacing_zw_override)
    character_spacing_zw = min(max(character_spacing_zw, -0.5), 1.0)

    line_gap_pt = safe_font_size * line_gap_ratio
    line_leading_pt = safe_font_size * line_leading_ratio

    return {
        "font_size_pt": safe_font_size,
        "character_spacing_zw": character_spacing_zw,
        "character_pitch_zw": JIS_CHARACTER_PITCH_ZW,
        "line_gap_ratio": line_gap_ratio,
        "line_gap_pt": line_gap_pt,
        "line_leading_ratio": line_leading_ratio,
        "line_leading_pt": line_leading_pt,
        "paragraph_indent_zw": JIS_PARAGRAPH_INDENT_ZW,
    }


def get_pdf_size(
    device: Optional[str] = None,
    *,
    include_custom: bool = True,
) -> tuple[float, float]:
    """デバイス名から用紙サイズ (width, height) mm を返す。"""
    device_name = device or "smart"
    profile = settings_store.get_device_settings(
        device_name,
        include_custom=include_custom,
    )
    return float(profile["width_mm"]), float(profile["height_mm"])


def get_pdf_settings(
    device: Optional[str] = None,
    *,
    include_custom: bool = True,
) -> tuple[str, float, float, float]:
    """
    設定ファイルからフォント・レイアウト設定を取得する。

    戻り値: (font, font_size, line_leading_ratio, character_spacing)

    - font_size は ini の値（小数可）
    - line_leading_ratio / character_spacing は JIS 準拠の計算値（コード内定義）
    """
    device_name = device or "smart"
    global_settings = settings_store.get_global_settings(include_custom=include_custom)
    profile = settings_store.get_device_settings(
        device_name,
        include_custom=include_custom,
    )

    font = str(global_settings["font_family"])
    font_size = float(profile["font_size"])
    typesetting = _compute_jis_typesetting_metrics(
        font_size,
        line_gap_ratio_override=float(profile.get("line_gap_ratio", JIS_DEFAULT_LINE_GAP_RATIO)),
        line_leading_ratio_override=float(profile.get("line_leading_ratio", 1.0 + JIS_DEFAULT_LINE_GAP_RATIO)),
        character_spacing_zw_override=float(profile.get("character_spacing_zw", JIS_SOLID_CHARACTER_SPACING_ZW)),
    )
    line_leading_ratio = float(typesetting["line_leading_ratio"])
    character_spacing = float(typesetting["character_spacing_zw"])
    return font, font_size, line_leading_ratio, character_spacing


def _compute_jis_characters_per_line(
    device_name: str,
    font_size: float,
    page_height_mm: float,
    margin_top_mm: float,
    margin_bottom_mm: float,
    *,
    character_spacing_zw: float = JIS_SOLID_CHARACTER_SPACING_ZW,
) -> int:
    """
    固定余白と字送りから、本文領域に収まる 1 行字数を計算する。

    本文領域の中央再配置は行わず、設定余白の内側だけを使う。
    """
    del device_name

    safe_font_size = max(0.1, float(font_size))
    safe_character_pitch_zw = max(
        0.1,
        JIS_CHARACTER_PITCH_ZW + float(character_spacing_zw),
    )
    char_size_mm = safe_font_size * safe_character_pitch_zw * PT_TO_MM
    reserved_margin_mm = max(0.0, float(margin_top_mm)) + max(
        0.0, float(margin_bottom_mm)
    )
    usable_height_mm = max(
        char_size_mm,
        float(page_height_mm) - reserved_margin_mm,
    )
    return max(1, int(math.floor(usable_height_mm / max(char_size_mm, 0.1))))


def _compute_jis_lines_per_column(
    page_width_mm: float,
    margin_left_mm: float,
    margin_right_mm: float,
    font_size: float,
    line_leading_ratio: float,
    *,
    columns: int,
) -> int:
    """
    固定余白と行送りから、本文領域に収まる 1 段あたりの行数を計算する。

    二段組は `columnsep`（段間）として 1 行分の字送りを確保し、その残りを
    左右の段へ等分する。本文の中央再配置は行わない。
    """
    safe_font_size = max(0.1, float(font_size))
    safe_line_leading_ratio = max(0.8, float(line_leading_ratio))
    line_pitch_mm = safe_font_size * safe_line_leading_ratio * PT_TO_MM
    reserved_margin_mm = max(0.0, float(margin_left_mm)) + max(
        0.0, float(margin_right_mm)
    )
    usable_width_mm = max(
        line_pitch_mm,
        float(page_width_mm) - reserved_margin_mm,
    )
    if columns == 2:
        column_gap_mm = line_pitch_mm
        usable_width_mm = max(
            line_pitch_mm,
            (usable_width_mm - column_gap_mm) / 2.0,
        )
    return max(1, int(math.floor(usable_width_mm / max(line_pitch_mm, 0.1))))


def get_device_layout_settings(
    device: Optional[str] = None,
    *,
    include_custom: bool = True,
) -> dict[str, Any]:
    return settings_store.get_device_settings(
        device or "smart",
        include_custom=include_custom,
    )


def get_color_settings(
    *,
    include_custom: bool = True,
) -> tuple[str, str]:
    """
    設定ファイルから現在の配色設定を取得する。

    戻り値: (background_color, text_color)  — 例: ("#FFFFFF", "#000000")
    """
    global_settings = settings_store.get_global_settings(include_custom=include_custom)
    return (
        str(global_settings["background_color"]),
        str(global_settings["text_color"]),
    )


def save_current_settings(
    background_color: str,
    text_color: str,
    font_override: Optional[str] = None,
) -> None:
    global_updates: dict[str, Any] = {
        "background_color": background_color,
        "text_color": text_color,
    }
    if font_override:
        global_updates["font_family"] = font_override

    settings_store.save_settings(
        {
            "global": global_updates,
        }
    )


# -----------------------
# ファイル読み込み
# -----------------------


def _extract_declared_encoding(raw: bytes) -> Optional[str]:
    """
    入力ファイルが宣言しているエンコーディングを先頭付近から推測します。

    青空文庫の XHTML は次のような宣言を持つことが多いです:
    - XML 宣言: ``<?xml version="1.0" encoding="Shift_JIS"?>``
    - HTML meta: ``<meta charset="utf-8">`` や ``<meta http-equiv=... charset=...>``

    見つからなければ None を返します。
    """
    head = raw[:4096].decode("ascii", errors="ignore")

    m = re.search(r'encoding\s*=\s*["\']\s*([A-Za-z0-9._\-:]+)\s*["\']', head, re.I)
    if m:
        return m.group(1)

    m = re.search(r"charset\s*=\s*([A-Za-z0-9._\-:]+)", head, re.I)
    if m:
        return m.group(1)

    return None


def read_text_with_fallback(
    path: Path, preferred: Optional[str] = None
) -> tuple[str, str]:
    """
    ファイルをバイナリで読み、複数の候補エンコーディングを順に試して str にします。

    優先順位:
    1. ユーザーが ``--encoding`` で指定したもの (preferred)
    2. ファイル内の宣言（XML宣言 / meta charset から推測）
    3. よくある候補 (utf-8-sig / utf-8 / cp932 / shift_jis)

    戻り値:
    - text: 正規化済みテキスト（改行は ``\\n`` に統一）
    - encoding_used: 実際にデコードに成功したエンコーディング名
    """
    raw = path.read_bytes()
    declared = _extract_declared_encoding(raw)

    candidates: list[str] = []
    for enc in (preferred, declared, "utf-8-sig", "utf-8", "cp932", "shift_jis"):
        if enc and enc not in candidates:
            candidates.append(enc)

    last_err: Optional[Exception] = None
    for enc in candidates:
        try:
            text = raw.decode(enc)
            return text.replace("\r\n", "\n").replace("\r", "\n"), enc
        except Exception as e:
            last_err = e

    raise UnicodeDecodeError(
        "unknown", b"", 0, 1, f"decode failed: {path} ({last_err})"
    )


def fetch_html_local(
    path_str: str, preferred_encoding: Optional[str] = None
) -> tuple[str, str]:
    """
    ローカルファイルのみ読み込みます（URL ダウンロードはしません）。

    戻り値は (html_text, encoding_used)。
    """
    p = Path(path_str)
    if not p.exists():
        raise FileNotFoundError(f"Local file not found: {p}")
    if not p.is_file():
        raise FileNotFoundError(f"Not a file: {p}")
    return read_text_with_fallback(p, preferred=preferred_encoding)


# -----------------------
# LaTeX 変換
# -----------------------


def escape_latex(s: str) -> str:
    """
    LaTeX の特殊文字をエスケープします。

    ``# $ % & _ { } ~ ^ \\`` などが特別な意味を持つため本文として出したい場合は必須です。
    """
    s = s.replace("\\", r"\textbackslash{}")
    s = s.replace("{", r"\{").replace("}", r"\}")
    s = s.replace("%", r"\%").replace("$", r"\$").replace("&", r"\&")
    s = s.replace("#", r"\#").replace("_", r"\_").replace("^", r"\^{}")
    s = s.replace("~", r"\~{}")
    return s


def _is_block_break(tag: Tag) -> bool:
    """HTML のブロック要素かどうか（段落区切りを追加する目安）。"""
    if not isinstance(tag, Tag):
        return False
    name = tag.name.lower()
    return name in ("p", "div", "section", "article", "hr")


def _normalize_marker_tokens(raw: str) -> set[str]:
    normalized = re.sub(r"[-\s]+", "_", (raw or "").strip().lower())
    if not normalized:
        return set()
    return {normalized, normalized.replace("_", "")}


def _is_toc_marker_value(raw: str) -> bool:
    marker_tokens = {
        "toc",
        "tableofcontents",
        "table_of_contents",
        "contents",
        "mokuji",
        "mokuroku",
        "index",
    }
    tokens = _normalize_marker_tokens(raw)
    return any(token in marker_tokens for token in tokens)


def _tag_is_toc_block(tag: Tag) -> bool:
    if not isinstance(tag, Tag):
        return False
    tag_id = str(tag.get("id", "") or "")
    if _is_toc_marker_value(tag_id):
        return True
    classes = tag.get("class", [])
    if not isinstance(classes, list):
        classes = []
    return any(_is_toc_marker_value(str(c)) for c in classes)


def _is_toc_heading_text(text: str) -> bool:
    compact = re.sub(r"\s+", "", (text or ""))
    if not compact:
        return False
    return compact.lower() in {
        "目次",
        "もくじ",
        "contents",
        "tableofcontents",
    }


def _normalize_bookmark_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def convert_node_to_bookmark_text(node: Any) -> str:
    """
    BeautifulSoup のノードを PDF しおり向けの素朴な文字列へ変換します。

    本文表示用の TeX 命令は避け、見出しの意味が残る最小限の文字だけを返します。
    """
    if isinstance(node, NavigableString):
        return str(node)

    if not isinstance(node, Tag):
        return ""

    name = node.name.lower()

    if name in ("rp", "rt"):
        return ""

    if name == "ruby":
        rb = node.find("rb")
        if rb:
            return "".join(convert_node_to_bookmark_text(c) for c in rb.contents)
        return "".join(
            convert_node_to_bookmark_text(c)
            for c in node.contents
            if not (isinstance(c, Tag) and c.name.lower() in ("rp", "rt"))
        )

    if name == "br":
        return " "

    if name == "img":
        src = str(node.get("src", "") or "")
        alt = str(node.get("alt", "") or "")
        src_norm = normalize_src_path(src)
        classes: list[str] = (
            node.get("class", []) if isinstance(node.get("class", []), list) else []
        )
        if "gaiji" in classes:
            gaiji_unicode = _resolve_gaiji_unicode(src=src_norm, alt=alt)
            if gaiji_unicode:
                return gaiji_unicode
            return _build_gaiji_unknown_label(src=src_norm, alt=alt)
        return alt

    return "".join(convert_node_to_bookmark_text(c) for c in node.contents)


def _get_jisage_em(classes: list[str]) -> Optional[float]:
    """jisage_N クラスから N (em数) を取得する。見つからない場合は None。"""
    for cls in classes:
        m = re.match(r"^jisage_(\d+)$", cls)
        if m:
            return float(m.group(1))
    return None


def _build_heading_command(
    tag: Tag, command: str, indent_em: Optional[float] = None
) -> str:
    display_text = "".join(convert_node(c) for c in tag.contents)
    bookmark_text = _normalize_bookmark_text(
        "".join(convert_node_to_bookmark_text(c) for c in tag.contents)
    )
    if _is_toc_heading_text(bookmark_text):
        return ""
    if not display_text.strip():
        return ""
    if indent_em:
        display_text = rf"\hspace{{{indent_em:.6g}\zw}}" + display_text
    return (
        rf"\{command}{{{display_text}}}{{{escape_latex(bookmark_text)}}}" + "\n\n"
    )


def convert_ruby(tag: Tag) -> str:
    """
    ``<ruby><rb>親</rb><rt>ルビ</rt></ruby>`` を ``\\ltjruby{親}{ルビ}`` へ変換します。

    rb/rt 内に img.gaiji 等が混ざるケースがあるため、rb/rt は再帰変換します。
    ここで使う ``\\ltjruby`` は ``luatexja-ruby`` パッケージの命令です。
    """
    rb = tag.find("rb")
    rt = tag.find("rt")
    if rb and rt:
        text_rb = "".join(convert_node(c) for c in rb.contents)
        text_rt = "".join(convert_node(c) for c in rt.contents)
        return r"\ltjruby{" + text_rb + "}{" + text_rt + "}"
    inner = "".join(convert_node(c) for c in tag.contents)
    return inner


def _gaiji_alt_to_unicode(alt: str) -> Optional[str]:
    """外字 alt 注記から Unicode 置換できる文字があれば返す。"""
    normalized = (alt or "").strip()
    if not normalized:
        return None
    for key, uni_char in GAIJI_ALT_TO_UNICODE.items():
        if key in normalized:
            return uni_char
    return None


def _extract_gaiji_codepoint_text(alt: str) -> Optional[str]:
    """外字 alt 注記に含まれるコードポイント表記（U+XXXX 等）を返す。"""
    normalized = (alt or "").strip()
    if not normalized:
        return None

    patterns = (
        r"\bU\+([0-9A-Fa-f]{4,6})\b",
        r"\bUCS[-\s]*([0-9A-Fa-f]{4,6})\b",
    )
    for pattern in patterns:
        m = re.search(pattern, normalized, flags=re.IGNORECASE)
        if m:
            return "U+" + m.group(1).upper()

    return None


def convert_node(node: Any) -> str:
    """
    BeautifulSoup のノード（文字列 or タグ）を LaTeX 文字列に変換します。

    実装方針:
    - 「知らないタグは基本的に中身だけ再帰的に変換して素通し」
    - よく出る表現だけを明示的に LaTeX 命令へマップする（ruby、見出し、外字画像等）
    """
    if isinstance(node, NavigableString):
        return escape_latex(str(node))

    if not isinstance(node, Tag):
        return ""

    name = node.name.lower()

    # rp: HTML ruby の補助括弧。TeX 側で ruby を表現できるので捨てる。
    if name == "rp":
        return ""

    if name == "ruby":
        return convert_ruby(node)

    # 傍点（sesame_dot / bou クラス）
    classes: list[str] = (
        node.get("class", []) if isinstance(node.get("class", []), list) else []
    )

    if name == "em" and "sesame_dot" in classes:
        inner = "".join(convert_node(c) for c in node.contents)
        return r"\bouten{" + inner + "}"

    if name == "span" and "bou" in classes:
        inner = "".join(convert_node(c) for c in node.contents)
        return r"\bouten{" + inner + "}"

    if name in ("b", "strong"):
        inner = "".join(convert_node(c) for c in node.contents)
        return r"\textbf{" + inner + "}"

    if name == "br":
        return "\n\\par\n"

    if name == "p":
        inner = "".join(convert_node(c) for c in node.contents)
        return inner + "\n\n"

    if name == "img":
        src = str(node.get("src", "") or "")
        alt = str(node.get("alt", "") or "")
        src_norm = normalize_src_path(src)
        if "gaiji" in classes:
            gaiji_unicode = _resolve_gaiji_unicode(src=src_norm, alt=alt)
            if gaiji_unicode:
                codepoint = ord(gaiji_unicode)
                jigmo_font = _get_jigmo_db().select(codepoint)
                if jigmo_font:
                    return (
                        r"\AozoraGaijiGlyph{"
                        + escape_latex(jigmo_font)
                        + "}{"
                        + f"{codepoint:X}"
                        + "}{"
                        + escape_latex(gaiji_unicode)
                        + "}"
                    )
                return (
                    r"\AozoraGaijiAuto{"
                    + f"{codepoint:X}"
                    + "}{"
                    + escape_latex(gaiji_unicode)
                    + "}"
                )

            tooltip_payload = _build_gaiji_tooltip_payload(
                src=src_norm,
                alt=alt,
                html_fragment=str(node),
                unicode_char=None,
            )
            visible_label = _build_gaiji_unknown_label(src=src_norm, alt=alt)
            return (
                r"\AozoraGaijiUnknown{"
                + escape_latex(visible_label)
                + "}{"
                + escape_latex(tooltip_payload)
                + "}"
            )
        return (
            r"\AozoraImage{" + escape_latex(src_norm) + "}{" + escape_latex(alt) + "}"
        )

    if name == "h1":
        inner = "".join(convert_node(c) for c in node.contents)
        bookmark_text = _normalize_bookmark_text(
            "".join(convert_node_to_bookmark_text(c) for c in node.contents)
        )
        if _is_toc_heading_text(bookmark_text):
            return ""
        return (r"\AozoraTitle{" + inner + "}" + "\n\n") if inner.strip() else ""

    if name == "h2":
        return _build_heading_command(node, "AozoraPart")

    if name == "h3":
        return _build_heading_command(node, "AozoraChapter")

    if name in ("h4", "h5", "h6"):
        return _build_heading_command(node, "AozoraSection")

    if name in ("div", "span", "section", "article"):
        if _tag_is_toc_block(node):
            return ""
        # jisage_N div が見出しを包んでいる場合: 字下げ付きで見出しを出力
        jisage_em = _get_jisage_em(classes)
        if jisage_em is not None:
            heading_child = next(
                (
                    c
                    for c in node.children
                    if isinstance(c, Tag)
                    and c.name.lower() in ("h1", "h2", "h3", "h4", "h5", "h6")
                ),
                None,
            )
            if heading_child is not None:
                h_name = heading_child.name.lower()
                if h_name == "h1":
                    inner_h = "".join(convert_node(c) for c in heading_child.contents)
                    bm = _normalize_bookmark_text(
                        "".join(
                            convert_node_to_bookmark_text(c)
                            for c in heading_child.contents
                        )
                    )
                    if not _is_toc_heading_text(bm) and inner_h.strip():
                        indent = rf"\hspace{{{jisage_em:.6g}\zw}}"
                        return r"\AozoraTitle{" + indent + inner_h + "}" + "\n\n"
                    return ""
                cmd_map = {"h2": "AozoraPart", "h3": "AozoraChapter"}
                command = cmd_map.get(h_name, "AozoraSection")
                return _build_heading_command(heading_child, command, indent_em=jisage_em)
        inner = "".join(convert_node(c) for c in node.contents)
        return inner

    # 未対応タグ: 中身だけ再帰変換して素通し
    return "".join(convert_node(c) for c in node.contents)


def _select_main_text_root(soup: BeautifulSoup) -> Tag:
    """
    「本文が入っていそうな」ルート要素を探します。

    青空文庫のHTML/XHTMLでは以下の優先順で取得を試みます:
    1. body 全体（lxmlが div 内部でタグ構造を壊すケースに対応するため常に body を優先）
    2. id="main_text" の要素
    3. class="main_text" の div
    4. soup 全体

    Note: ``class="main_text"`` の div を直接返すと、lxml パーサーが
    ネストした HTML 構造を修正した結果 div が途中で閉じられ、本文末尾が
    欠落することがあります。body を起点にして _strip_after_sections() で
    不要ブロックを除去する方が確実です。
    """
    body = soup.find("body")
    if body is not None:
        return body
    # フォールバック: body が無ければ id/class で探す
    main = soup.find(id="main_text") or soup.find("div", class_="main_text")
    if main is not None:
        return main
    return soup  # type: ignore[return-value]


def _strip_after_sections(main_elem: Tag) -> Iterable:
    """
    body 全体から不要なブロック（ヘッダ・底本情報等）を除いた本文ノードを返します。

    青空文庫のHTML構造:
    - ``class="metadata"`` または ``class="header"`` : タイトル・著者の表示ブロック（スキップ）
    - ``class="main_text"`` : 本文ブロック（中身を yield）
    - ``class="bibliographical_information"`` / ``class="notation_notes"`` : 底本情報（スキップ）

    ``id="main_text"`` や ``class="main_text"`` の div が存在する場合は
    そのブロックの中身のみを yield し、それ以外のトップ要素はスキップします。
    ``main_text`` ブロックが見つからない場合は従来通り stop_classes で打ち切ります。
    """
    skip_classes = {
        "metadata",
        "header",
        "toc",
        "contents",
        "mokuji",
        "mokuroku",
        "table_of_contents",
        "navi",
        "navigation",
        "bibliographical_information",
        "notation_notes",
    }
    stop_classes = {"bibliographical_information", "notation_notes"}

    # body 内に main_text ブロックがあるか確認する
    main_text_div = main_elem.find(id="main_text") or main_elem.find(
        "div", class_="main_text"
    )

    if main_text_div is not None:
        # main_text div の子ノードを直接 yield（途中に stop_classes が来たら打ち切る）
        for child in list(main_text_div.children):
            if isinstance(child, Tag):
                if _tag_is_toc_block(child):
                    continue
                child_classes: list[str] = (
                    child.get("class", [])
                    if isinstance(child.get("class", []), list)
                    else []
                )
                if set(child_classes) & stop_classes:
                    break
            yield child
        # main_text の後ろに続く body の直接子要素もチェック（本文末尾が外に漏れた場合）
        found_main = False
        for sibling in list(main_elem.children):
            if sibling is main_text_div:
                found_main = True
                continue
            if not found_main:
                continue
            if isinstance(sibling, Tag):
                if _tag_is_toc_block(sibling):
                    continue
                sibling_classes: list[str] = (
                    sibling.get("class", [])
                    if isinstance(sibling.get("class", []), list)
                    else []
                )
                # 後続の stop_classes に当たったら終了
                if set(sibling_classes) & stop_classes:
                    break
                # skip_classes（metadata等）はスキップ
                if set(sibling_classes) & skip_classes:
                    continue
            yield sibling
    else:
        # main_text div が無い場合: body の子ノードを skip/stop_classes で制御して yield
        for child in list(main_elem.children):
            if isinstance(child, Tag):
                if _tag_is_toc_block(child):
                    continue
                child_classes_2: list[str] = (
                    child.get("class", [])
                    if isinstance(child.get("class", []), list)
                    else []
                )
                if set(child_classes_2) & stop_classes:
                    break
                if set(child_classes_2) & skip_classes:
                    continue
            yield child


def html_to_latex_body(html: str, parser: str = "html.parser") -> str:
    """
    HTML/XHTML 文字列から、LaTeX に埋め込む「本文部分」を生成します。

    流れ:
    1. BeautifulSoup でパース
    2. 本文ルートを選び
    3. 子ノードを ``convert_node`` で LaTeX 化して連結
    4. 変換結果をそのまま連結
    """
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

    features = "lxml-xml" if parser in ("xml", "lxml-xml") else parser
    if features == "lxml":
        features = "html.parser"
    soup = BeautifulSoup(html, features)
    main_elem = _select_main_text_root(soup)

    parts: list[str] = []
    for child in _strip_after_sections(main_elem):
        parts.append(convert_node(child))

    body = "".join(parts)
    return body


def normalize_src_path(src: str) -> str:
    """
    青空HTMLの img src を TeX 側で扱いやすい相対パスへ正規化します。

    例:
    - ``"../../../gaiji/1-01/1-01-01.png"`` → ``"gaiji/1-01/1-01-01.png"``
    - ``"../images/foo.png"`` → ``"images/foo.png"``
    """
    s = (str(src) if src else "").strip().replace("\\", "/")
    if not s:
        return s
    i = s.find("gaiji/")
    if i >= 0:
        return s[i:]
    while s.startswith("./"):
        s = s[2:]
    while s.startswith("../"):
        s = s[3:]
    return s


# -----------------------
# LaTeX テンプレート
# -----------------------

DEFAULT_FRONTCOVER_TEMPLATE = r"""%% ---- FrontCover ----
{{cover_texture_block}}
\begin{titlepage}
\csname thispagestyle\endcsname{empty}
  \centering
  \vspace*{\fill}
    {{\ltjsetparameter{kanjiskip={0.18\zw plus 0.06\zw minus 0.03\zw}}\fontsize{30pt}{36pt}\selectfont \textbf{{{title}}}}}\par
    \vspace{14mm}
    {{\ltjsetparameter{kanjiskip={0.14\zw plus 0.05\zw minus 0.03\zw}}\fontsize{22pt}{28pt}\selectfont {{{author}}}}}\par
  \vspace*{\fill}
\end{titlepage}
"""

DEFAULT_TYPESETTING_INFO_TEMPLATE = r"""%% ---- Typesetting_info ----
\newpage
{{typesetting_info_texture_block}}
{{typesetting_info_body}}
"""

DEFAULT_MAIN_TEXT_TEMPLATE = r"""%% ---- Main_text ----
\clearpage
\setcounter{page}{1}
\pagestyle{{{pagestyle_name}}}
{{main_overlay_start}}
{{pre_main_text_layout}}
{{main_text_body}}
\label{LastBodyPage}
"""

DEFAULT_COLOPHON_TEMPLATE = r"""%% ---- Colophon ----
{{main_overlay_end}}
{{colophon_texture_block}}
{{colophon_frame_block}}
\thispagestyle{empty}
\begingroup
\small
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\begin{flushleft}
{{colophon_body}}
\end{flushleft}
\endgroup
"""

DEFAULT_COLOPHON_BODY = "\n".join(
    [
        r"\begin{center}",
        r"\vspace*{\fill}",
        r"{\Large お読みいただきありがとうございました。}\\[1cm]",
        r"{\small 本書の著作権は著者に帰属します。}",
        r"\vspace*{\fill}",
        r"\end{center}",
    ]
)

TEMPLATE_KEY_PATTERN = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")


def render_template_block(template_text: str, values: dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        return values.get(match.group(1), "")

    rendered = TEMPLATE_KEY_PATTERN.sub(repl, template_text)
    if not rendered.endswith("\n"):
        rendered += "\n"
    return rendered


def load_frontcover_template() -> str:
    return DEFAULT_FRONTCOVER_TEMPLATE.strip() + "\n"


def load_typesetting_info_template() -> str:
    return DEFAULT_TYPESETTING_INFO_TEMPLATE.strip() + "\n"


def load_main_text_template() -> str:
    return DEFAULT_MAIN_TEXT_TEMPLATE.strip() + "\n"


def load_colophon_template() -> str:
    return DEFAULT_COLOPHON_TEMPLATE.strip() + "\n"


def load_washi_texture_template() -> str:
    return WASHI_TEXTURE_TEMPLATE.strip() + "\n"


WASHI_DEVICE_PROFILES: dict[str, dict[str, float]] = {
    "smart": {
        "patch_density": 0.00020,
        "fiber_density": 0.00750,
        "speck_density": 0.01300,
        "fiber_len_min": 4.0,
        "fiber_len_max": 14.0,
        "fiber_bend_max": 2.4,
        "laid_step_x": 5.0,
        "laid_step_y": 10.0,
    },
    "tablet": {
        "patch_density": 0.00018,
        "fiber_density": 0.00620,
        "speck_density": 0.01100,
        "fiber_len_min": 6.0,
        "fiber_len_max": 20.0,
        "fiber_bend_max": 3.3,
        "laid_step_x": 7.0,
        "laid_step_y": 11.0,
    },
    "pc": {
        "patch_density": 0.00014,
        "fiber_density": 0.00480,
        "speck_density": 0.00800,
        "fiber_len_min": 8.0,
        "fiber_len_max": 24.0,
        "fiber_bend_max": 4.2,
        "laid_step_x": 8.0,
        "laid_step_y": 12.0,
    },
}

WASHI_SECTION_PROFILES: dict[str, dict[str, float]] = {
    "cover": {
        "patch_scale": 0.58,
        "fiber_scale": 0.52,
        "speck_scale": 0.50,
        "length_scale": 0.86,
        "opacity_scale": 0.90,
    },
    "typesetting_info": {
        "patch_scale": 0.66,
        "fiber_scale": 0.62,
        "speck_scale": 0.60,
        "length_scale": 0.88,
        "opacity_scale": 0.88,
    },
    "main": {
        "patch_scale": 1.00,
        "fiber_scale": 1.00,
        "speck_scale": 1.00,
        "length_scale": 1.00,
        "opacity_scale": 1.00,
    },
    "colophon": {
        "patch_scale": 0.72,
        "fiber_scale": 0.68,
        "speck_scale": 0.66,
        "length_scale": 0.90,
        "opacity_scale": 0.85,
    },
}

WASHI_SECTION_COLORS: dict[str, dict[str, str]] = {
    "cover": {
        "cloud_a": "F3E8D2",
        "cloud_b": "EADABC",
        "cloud_c": "D7C2A0",
        "fiber_a": "9B8460",
        "fiber_b": "7D6747",
        "fiber_c": "5E4C36",
        "speck_a": "735A40",
        "speck_b": "4F3E2D",
    },
    "typesetting_info": {
        "cloud_a": "F5EEDD",
        "cloud_b": "ECE2CB",
        "cloud_c": "DCCFB5",
        "fiber_a": "8E785A",
        "fiber_b": "746148",
        "fiber_c": "584937",
        "speck_a": "68533D",
        "speck_b": "453729",
    },
    "main": {
        "cloud_a": "F4ECD9",
        "cloud_b": "E9DFC7",
        "cloud_c": "D9CCAF",
        "fiber_a": "927C59",
        "fiber_b": "766146",
        "fiber_c": "5A4936",
        "speck_a": "6A533C",
        "speck_b": "473727",
    },
    "colophon": {
        "cloud_a": "F7F1E2",
        "cloud_b": "EEE5CF",
        "cloud_c": "DED2B6",
        "fiber_a": "8A7658",
        "fiber_b": "6E5C44",
        "fiber_c": "534332",
        "speck_a": "65503B",
        "speck_b": "423427",
    },
}


def _build_washi_render_values(
    device: str,
    section: str,
    page_width_mm: float,
    page_height_mm: float,
    base_bg_hex: str,
) -> dict[str, str]:
    device_profile = WASHI_DEVICE_PROFILES.get(device, WASHI_DEVICE_PROFILES["smart"])
    section_profile = WASHI_SECTION_PROFILES.get(
        section,
        WASHI_SECTION_PROFILES["main"],
    )
    colors = WASHI_SECTION_COLORS.get(section, WASHI_SECTION_COLORS["main"])

    area = max(page_width_mm * page_height_mm, 1.0)
    patch_count = max(
        10, int(area * device_profile["patch_density"] * section_profile["patch_scale"])
    )
    fiber_count = max(
        80, int(area * device_profile["fiber_density"] * section_profile["fiber_scale"])
    )
    speck_count = max(
        110,
        int(area * device_profile["speck_density"] * section_profile["speck_scale"]),
    )

    x_extent = page_width_mm * 0.5 + 8.0
    y_extent = page_height_mm * 0.5 + 8.0

    length_scale = section_profile["length_scale"]
    opacity_scale = section_profile["opacity_scale"]

    patch_rx_min = 8.0 * length_scale
    patch_rx_max = 30.0 * length_scale
    patch_ry_min = 5.0 * length_scale
    patch_ry_max = 22.0 * length_scale

    fiber_len_min = device_profile["fiber_len_min"] * length_scale
    fiber_len_max = device_profile["fiber_len_max"] * length_scale
    fiber_bend_max = device_profile["fiber_bend_max"] * length_scale

    values: dict[str, str] = {
        "section_label": section,
        "base_bg_hex": base_bg_hex,
        "page_width_mm": f"{page_width_mm:.2f}",
        "page_height_mm": f"{page_height_mm:.2f}",
        "x_extent_mm": f"{x_extent:.2f}",
        "y_extent_mm": f"{y_extent:.2f}",
        "laid_step_x": f"{device_profile['laid_step_x']:.0f}",
        "laid_step_y": f"{device_profile['laid_step_y']:.0f}",
        "laid_x_max": f"{page_width_mm + 14.0:.0f}",
        "laid_y_max": f"{page_height_mm + 20.0:.0f}",
        "patch_count": str(patch_count),
        "patch_rx_min_mm": f"{patch_rx_min:.2f}",
        "patch_rx_max_mm": f"{patch_rx_max:.2f}",
        "patch_ry_min_mm": f"{patch_ry_min:.2f}",
        "patch_ry_max_mm": f"{patch_ry_max:.2f}",
        "patch_op_min": f"{0.012 * opacity_scale:.4f}",
        "patch_op_max": f"{0.032 * opacity_scale:.4f}",
        "fiber_count": str(fiber_count),
        "fiber_len_min_mm": f"{fiber_len_min:.2f}",
        "fiber_len_max_mm": f"{fiber_len_max:.2f}",
        "fiber_bend_max_mm": f"{fiber_bend_max:.2f}",
        "fiber_op_min": f"{0.028 * opacity_scale:.4f}",
        "fiber_op_max": f"{0.090 * opacity_scale:.4f}",
        "fiber_lw_min_mm": f"{0.035 * opacity_scale:.3f}",
        "fiber_lw_max_mm": f"{0.145 * opacity_scale:.3f}",
        "speck_count": str(speck_count),
        "speck_radius_min_mm": "0.08",
        "speck_radius_max_mm": f"{0.62 * length_scale:.3f}",
        "speck_op_min": f"{0.014 * opacity_scale:.4f}",
        "speck_op_max": f"{0.068 * opacity_scale:.4f}",
        "base_fill_opacity": f"{0.23 * opacity_scale:.3f}",
        "line_x_opacity": f"{0.045 * opacity_scale:.3f}",
        "line_y_opacity": f"{0.036 * opacity_scale:.3f}",
        "cloud_color_a": colors["cloud_a"],
        "cloud_color_b": colors["cloud_b"],
        "cloud_color_c": colors["cloud_c"],
        "fiber_color_a": colors["fiber_a"],
        "fiber_color_b": colors["fiber_b"],
        "fiber_color_c": colors["fiber_c"],
        "speck_color_a": colors["speck_a"],
        "speck_color_b": colors["speck_b"],
    }
    return values


def render_washi_texture_by_section(
    template_text: str,
    device: str,
    section: str,
    page_width_mm: float,
    page_height_mm: float,
    base_bg_hex: str,
) -> str:
    if not template_text.strip():
        return ""
    values = _build_washi_render_values(
        device=device,
        section=section,
        page_width_mm=page_width_mm,
        page_height_mm=page_height_mm,
        base_bg_hex=base_bg_hex,
    )
    return render_template_block(template_text, values).strip()


def _normalize_hex_color_for_latex(color: str, fallback: str) -> str:
    value = str(color or "").strip().lstrip("#").upper()
    if re.fullmatch(r"[0-9A-F]{6}", value):
        return value
    return fallback


def _normalize_variant(variant: Optional[int], fallback: int = 1) -> int:
    if variant in (1, 2, 3):
        return int(variant)
    return fallback


def load_cover_texture_template(variant: int) -> str:
    return COVER_TEXTURE_TEMPLATES.get(_normalize_variant(variant), "").strip()


def load_main_frame_template(variant: int) -> str:
    return MAIN_FRAME_TEMPLATES.get(_normalize_variant(variant), "").strip()


def _make_image_overlay_snippet(image_path: str, opacity: float) -> str:
    normalized_path = str(image_path or "").strip().replace("\\", "/")
    if not normalized_path:
        return ""
    normalized_opacity = _normalize_background_opacity(opacity, 1.0)
    opacity_text = f"{normalized_opacity:.3f}".rstrip("0").rstrip(".")
    return (
        r"\node[anchor=center, inner sep=0pt, opacity="
        + opacity_text
        + r"] at (current page.center) {"
        + "\n"
        + r"    \includegraphics[width=\paperwidth,height=\paperheight]{"
        + normalized_path
        + r"}%"
        + "\n"
        + r"};"
    )


def _make_one_page_overlay_block(snippet: str) -> str:
    body = snippet.strip()
    if not body:
        return ""
    return (
        "\\AddToShipoutPictureBG*{%\n"
        "\\begin{tikzpicture}[remember picture, overlay]\n"
        + body
        + "\n\\end{tikzpicture}%\n"
        "}\n"
    )


def _make_multi_page_overlay_start(snippet: str) -> str:
    body = snippet.strip()
    if not body:
        return ""
    return (
        "\\AddToShipoutPictureBG{%\n"
        "\\begin{tikzpicture}[remember picture, overlay]\n"
        + body
        + "\n\\end{tikzpicture}%\n"
        "}\n"
    )


def _make_multi_page_overlay_end(has_overlay: bool) -> str:
    if not has_overlay:
        return ""
    return "\\ClearShipoutPictureBG\n"


def _extract_meta_content(soup: BeautifulSoup, key: str) -> str:
    """meta name="DC.Title" のようなメタデータを抽出する。"""
    meta = soup.find("meta", attrs={"name": re.compile(rf"^{re.escape(key)}$", re.I)})
    if meta and meta.get("content"):
        return str(meta.get("content")).strip()
    return ""


def extract_title_author(html: str, parser: str = "html.parser") -> tuple[str, str]:
    """
    青空文庫HTMLからタイトル・作者名を抽出する。

    優先順:
    1. DC.Title / DC.Creator
    2. metadata ブロックの h1.title / h2.author
    3. head > title
    """
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
    features = "lxml-xml" if parser in ("xml", "lxml-xml") else parser
    if features == "lxml":
        features = "html.parser"
    soup = BeautifulSoup(html, features)

    title = _extract_meta_content(soup, "DC.Title")
    author = _extract_meta_content(soup, "DC.Creator")

    if not title:
        title_node = soup.select_one("div.metadata h1.title") or soup.find("h1")
        if title_node:
            title = title_node.get_text(strip=True)

    if not author:
        author_node = soup.select_one("div.metadata h2.author") or soup.find("h2")
        if author_node:
            author = author_node.get_text(strip=True)

    if not title:
        head_title = soup.find("title")
        if head_title:
            title = head_title.get_text(strip=True)

    if not title:
        title = "タイトルをここに記入"
    if not author:
        author = "作者名をここに記入"

    return escape_latex(title), escape_latex(author)


def extract_title_author_raw(html: str, parser: str = "html.parser") -> tuple[str, str]:
    """青空文庫HTMLからタイトル・作者名を抽出し、非エスケープで返す。"""
    warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)
    features = "lxml-xml" if parser in ("xml", "lxml-xml") else parser
    if features == "lxml":
        features = "html.parser"
    soup = BeautifulSoup(html, features)

    title = _extract_meta_content(soup, "DC.Title")
    author = _extract_meta_content(soup, "DC.Creator")

    if not title:
        title_node = soup.select_one("div.metadata h1.title") or soup.find("h1")
        if title_node:
            title = title_node.get_text(strip=True)

    if not author:
        author_node = soup.select_one("div.metadata h2.author") or soup.find("h2")
        if author_node:
            author = author_node.get_text(strip=True)

    if not title:
        head_title = soup.find("title")
        if head_title:
            title = head_title.get_text(strip=True)

    if not title:
        title = "タイトルをここに記入"
    if not author:
        author = "作者名をここに記入"

    return title, author


def sanitize_filename_component(text: str, fallback: str) -> str:
    """Windows/Unix 互換で安全なファイル名コンポーネントへ正規化する。"""
    component = re.sub(r"\s+", " ", str(text)).strip()
    component = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", component)
    component = component.rstrip(". ")
    return component or fallback


def build_output_stem(source_path: Path, title: str, author: str) -> str:
    """`元ファイル名_タイトル_作者名` 形式の出力ステムを返す。"""
    safe_title = sanitize_filename_component(title, "title")
    safe_author = sanitize_filename_component(author, "author")
    return f"{source_path.stem}_{safe_title}_{safe_author}"


def resolve_cli_work_outdir(out_arg: str, device: str) -> Path:
    """CLI の `--out` から実際の `work/<device>` 出力先を解決する。"""
    base_dir = (WORKDIR / out_arg).resolve()
    normalized_device = str(device).strip().lower()

    if (
        base_dir.name.lower() == normalized_device
        and base_dir.parent.name.lower() == "work"
    ):
        return base_dir
    if base_dir.name.lower() == "work":
        return base_dir / normalized_device
    return base_dir / "work" / normalized_device


def extract_bibliographical_information(html: str, parser: str = "html.parser") -> str:
    """
    青空文庫HTMLの bibliographical_information ブロックを抽出して、
    奥付用のプレーンテキストに正規化する。
    """
    # XHTML では namespace やタグ不整合の影響で直接 find() しづらい場合があるため、
    # まず raw 文字列から該当ブロックを抜き出してから整形する。
    m = re.search(
        r'<div[^>]*class=["\'](?:[^"\']*\s)?bibliographical_information(?:\s[^"\']*)?["\'][^>]*>(.*?)</div>',
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not m:
        return ""

    # 変換しやすいようにクローンして、不要要素を落としてから改行を抽出する
    fragment = BeautifulSoup(m.group(1), "html.parser")
    for tag_name in ("hr", "script", "style"):
        for t in fragment.find_all(tag_name):
            t.decompose()
    for br in fragment.find_all("br"):
        br.replace_with("\n")

    text = fragment.get_text()
    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        lines.append(line)

    return "\n".join(lines)


def build_colophon_body_from_html(html: str, parser: str = "html.parser") -> str:
    """
    HTML から Colophon 本文を抽出して LaTeX 行へ整形する。
    抽出できない場合は既定の Colophon 文面へフォールバックする。
    """
    bib_text = extract_bibliographical_information(html, parser=parser)
    if not bib_text:
        return DEFAULT_COLOPHON_BODY

    rows: list[str] = []
    for line in bib_text.splitlines():
        if line == "":
            rows.append(r"\\")
            continue
        rows.append(escape_latex(line) + r"\\")

    if rows and rows[-1] == r"\\":
        rows.pop()

    return "\n".join(rows)


def load_okuduke_template() -> str:
    """
    Colophon (奥付) テンプレートを返す。
    テンプレートは Python コード内の既定値を使用する。
    """
    return load_colophon_template()


def build_okuduke_from_html(html: str, parser: str = "html.parser") -> str:
    """
    HTML から奥付本文を抽出して LaTeX 形式で生成する。
    build_colophon_body_from_html のエイリアス。
    """
    return build_colophon_body_from_html(html, parser=parser)


LATEX_TEMPLATE_JLREQ_TATE = r"""\documentclass[%(font_size)spt,paper={%(width)smm,%(height)smm},tate%(docclass_extra)s,head_space=%(margin_top)smm,foot_space=%(margin_bottom)smm,gutter=%(margin_left)smm,fore-edge=%(margin_right)smm]{jlreq}
\usepackage{luatexja}
\usepackage{luatexja-fontspec}
\usepackage{luatexja-ruby}
\usepackage{graphicx}
\PassOptionsToPackage{unicode=true,pdfpagelayout=SinglePage,bookmarksnumbered=true}{hyperref}
\usepackage{hyperref}
\usepackage{bookmark}
\bookmarksetup{depth=3}
\newif\ifAozoraPdfComment
\IfFileExists{pdfcomment.sty}{%%
  \usepackage{pdfcomment}
  \pdfcommentsetup{final}
  \AozoraPdfCommenttrue
}{%%
  \AozoraPdfCommentfalse
}
\newif\ifAozoraLuaGaijiReady
\AozoraLuaGaijiReadyfalse
\directlua{
  local ok = pcall(function()
%(jigmo_coverage_lua)s
  end)
    local bs = string.char(92)
    local pct = string.char(37)
  aozora_emit_gaiji_auto = function(cp_hex, fallback_text)
    local cp = tonumber(cp_hex, 16)
    local selected = nil
    if cp and type(jigmo_select) == "function" then
      selected = jigmo_select(cp)
    end
    if selected and selected ~= "" then
            local cp_hex_upper = string.format(pct .. 'X', cp)
            tex.sprint(bs .. 'AozoraGaijiGlyph{' .. selected .. '}{' .. cp_hex_upper .. '}{' .. fallback_text .. '}')
    else
            tex.sprint(bs .. 'AozoraGaijiUnicode{' .. fallback_text .. '}')
    end
  end
  if ok and type(jigmo_select) == "function" then
        tex.sprint(bs .. 'global' .. bs .. 'AozoraLuaGaijiReadytrue')
  end
}
\usepackage{xcolor}
\usepackage{eso-pic}
\usepackage{tikz}
\usetikzlibrary{calc}
\usepackage{lltjext}
%% geometry は jlreq と競合するため \documentclass のオプションで余白を指定
\linespread{1.0}



%% ---- ページめくり方向（横送り: 右→左）----
%% スマホ/タブレットで左→右スワイプ時に次ページへ進みやすい方向を推奨する
\pdfcatalog{/PageLayout /SinglePage /ViewerPreferences << /Direction /R2L >>}

%% ---- カラー設定 ----
\definecolor{AozoraBg}{HTML}{%(bg_color)s}
\definecolor{AozoraFg}{HTML}{%(fg_color)s}
\pagecolor{AozoraBg}
\color{AozoraFg}

%% ---- ページスタイル (jlreq 内蔵 nombre を使用) ----
%% スマホデバイスはページ番号なし（show_page_number=0 のとき）
%(page_style_block)s

%% ---- Aozora helpers ----
\newcounter{AozoraPartCounter}
\newcounter{AozoraChapterCounter}[AozoraPartCounter]
\newcounter{AozoraSectionCounter}[AozoraChapterCounter]
\newcommand{\AozoraTitle}[1]{\par\addvspace{\zh}#1\par\addvspace{\zh}}
\pdfstringdefDisableCommands{%%
  \def\ltjruby#1#2{#1}%%
  \def\bouten#1{#1}%%
  \def\textbf#1{#1}%%
  \def\AozoraTooltip#1#2{#1}%%
  \def\AozoraGaijiGlyph#1#2#3{#3}%%
  \def\AozoraGaijiUnknown#1#2{#1}%%
  \def\AozoraGaijiUnicode#1{#1}%%
  \def\AozoraGaijiAuto#1#2{#2}%%
  \def\AozoraImage#1#2{#2}%%
}
\newcommand{\AozoraPart}[2]{%%
  \par\addvspace{\zh}%%
    \refstepcounter{AozoraPartCounter}%%
  \phantomsection
    \pdfbookmark[0]{#2}{aozora-part-\theAozoraPartCounter}%%
  #1\par%%
  \addvspace{\zh}%%
}
\newcommand{\AozoraChapter}[2]{%%
  \par\addvspace{\zh}%%
    \refstepcounter{AozoraChapterCounter}%%
  \phantomsection
    \pdfbookmark[1]{#2}{aozora-chapter-\theAozoraPartCounter-\theAozoraChapterCounter}%%
  #1\par%%
  \addvspace{\zh}%%
}
\newcommand{\AozoraSection}[2]{%%
  \par\addvspace{\zh}%%
    \refstepcounter{AozoraSectionCounter}%%
  \phantomsection
    \pdfbookmark[2]{#2}{aozora-section-\theAozoraPartCounter-\theAozoraChapterCounter-\theAozoraSectionCounter}%%
  #1\par%%
  \addvspace{\zh}%%
}
\newcommand{\AozoraMidashi}[1]{\AozoraSection{#1}{#1}}
\newcommand{\bouten}[1]{#1}%% 必要なら傍点用に差し替え
\newcommand{\AozoraJisage}[2]{#2}

%% 外字/画像（src はHTMLの相対パスのまま出す）
%% 外字は JISX0213 -> Unicode へ寄せ、未解決時は [GAIJI:code] + tooltip へフォールバック
\newcommand{\AozoraTooltip}[2]{%%
  \ifAozoraPdfComment%%
    \pdftooltip{#1}{#2}%%
  \else%%
    #1%%
  \fi%%
}
\newcommand{\AozoraGaijiGlyph}[3]{{\fontspec{#1}\char"#2}}
\newcommand{\AozoraGaijiMarker}[1]{{\scriptsize\textcolor{AozoraFg!80!AozoraBg}{\textbf{[GAIJI:#1]}}}}
\newcommand{\AozoraGaijiUnknown}[2]{{\AozoraTooltip{\AozoraGaijiMarker{#1}}{#2}}}
\newcommand{\AozoraGaiji}[2]{\AozoraGaijiUnknown{#1}{src=#1 | alt=#2}}
%% Unicode表示の外字注記は本文より小さく・薄く出す
\newcommand{\AozoraGaijiUnicode}[1]{{\footnotesize\textcolor{AozoraFg!55!AozoraBg}{#1}}}
\newcommand{\AozoraGaijiAuto}[2]{%%
  \ifAozoraLuaGaijiReady%%
    \directlua{aozora_emit_gaiji_auto("\luaescapestring{#1}", "\luaescapestring{#2}")}%%
  \else%%
    \AozoraGaijiUnicode{#2}%%
  \fi%%
}
\newcommand{\AozoraImage}[2]{%%
  \IfFileExists{#1}{\includegraphics{#1}}{[IMAGE]}%%
}

\setmainjfont{%(font)s}
%(layout_tweak)s
%(washi_texture_block)s

\begin{document}

%(frontcover_block)s

%(pre_typesetting_info_layout)s
%(typesetting_info_block)s

%(main_text_block)s

%(pre_colophon_layout)s
%(colophon_block)s

\end{document}
"""


def build_info_page(
    html_path: Optional[Path],
    font: str,
    font_size: float,
    chars: int,
    lines_per_column: int,
    spacing: float,
    character_spacing: float,
    width: float,
    height: float,
    device: str,
    margin_top: float,
    margin_bottom: float,
    margin_left: float,
    margin_right: float,
    columns: int,
    show_page_number: bool,
) -> str:
    """
    Typesetting_info（タイトルページ直後）の LaTeX ブロックを生成する。

    記載内容:
    - ファイル情報（名前・サイズ・日付）
    - フォント設定（名前・サイズ・ルビサイズ）
    - レイアウト設定（列数・字数・行数・文字サイズ / 字間・行間・行送り）
    - 用紙・余白設定（デバイス・サイズ・余白・ページ番号位置）
    - 追加情報（行送り基準を含む）
    - 手動コンパイル手順
    """
    if html_path is not None and html_path.exists():
        stat = html_path.stat()
        fsize_bytes = stat.st_size
        if fsize_bytes >= 1024 * 1024:
            fsize_str = f"{fsize_bytes / 1024 / 1024:.1f} MB"
        else:
            fsize_str = f"{fsize_bytes / 1024:.1f} KB"
        html_name = escape_latex(html_path.name)
        file_date = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
    else:
        fsize_str = "不明"
        html_name = "不明"
        file_date = "不明"

    # 1pt = 0.35278mm（PostScript pt）
    char_size_mm = font_size * PT_TO_MM
    line_gap_ratio = max(0.0, float(spacing) - 1.0)
    line_gap_mm = char_size_mm * line_gap_ratio
    line_height_mm = char_size_mm * float(spacing)
    line_leading_zh_value = f"{float(spacing):.3f}".rstrip("0").rstrip(".")
    line_leading_tex = f"{line_leading_zh_value}\\zh"
    ruby_pt = font_size / 2.0
    font_size_label = f"{font_size:g}"

    page_number_desc = "表示" if show_page_number else "非表示"

    file_line = " ・ ".join(
        [
            rf"ファイル名：{html_name}",
            rf"ファイルサイズ：{fsize_str}",
            rf"ファイル日付：{escape_latex(file_date)}",
        ]
    )
    font_line = " ・ ".join(
        [
            rf"フォント名：{escape_latex(font)}",
            rf"本文サイズ：{font_size_label}pt",
            rf"ルビサイズ：{ruby_pt:.1f}pt",
        ]
    )
    # レイアウト設定：列数・字数・文字サイズは一行、行間・行送りは次の行
    layout_line_1 = " ・ ".join(
        [
            rf"本文列数：{columns}列",
            rf"一行の字数：{chars}字",
            (
                rf"一段の行数：{lines_per_column}行"
                if columns == 2
                else rf"行数：{lines_per_column}行"
            ),
            rf"一文字サイズ（1zw）：{char_size_mm:.2f}mm",
        ]
    )
    layout_line_2 = " ・ ".join(
        [
            rf"字間（kanjiskip）：{character_spacing:.3f}zw",
            rf"行間係数（k）：{line_gap_ratio:.2f}",
            rf"行送り（{line_leading_zh_value}zh）：約{line_height_mm:.2f}mm（行間 約{line_gap_mm:.2f}mm）",
        ]
    )
    paper_line = " ・ ".join(
        [
            rf"デバイス：{escape_latex(device)}",
            rf"用紙サイズ：{width:.1f}mm x {height:.1f}mm",
            rf"余白 上下左右：{margin_top:.1f}/{margin_bottom:.1f}/{margin_left:.1f}/{margin_right:.1f}mm",
            rf"ページ番号：{page_number_desc}",
        ]
    )
    # 追加情報：行送り基準を「・」で区切り、後で改行
    extra_parts = [
        r"組版エンジン：LuaLaTeX + jlreq（縦組）",
        r"外字処理：Unicode置換 + [GAIJI:code] tooltipフォールバック",
    ]
    extra_line = " ・ ".join(extra_parts)
    extra_line_with_linespeed = (
        extra_line
        + r" ・ 行送り基準：\texttt{\setlength{\baselineskip}{"
        + line_leading_tex
        + r"}}"
    )

    manual_rows = [
        "1. texファイル生成：",
        r"\quad\texttt{python -m src.aozoratex data/ -{}-device smart -{}-out out}",
        "2. PDF化（latexmkで自動コンパイル）：",
        r"\quad\texttt{latexmk -lualatex -silent -interaction=nonstopmode -file-line-error -synctex=1 -use-make -outdir=out/work/smart out/work/smart/file.tex}",
    ]

    lines = [
        r"\begingroup",
        r"\scriptsize",
        r"\setlength{\parindent}{0pt}",
        r"\setlength{\parskip}{0pt}",
        r"\thispagestyle{empty}",
        r"{\small\textbf{\ltjsetparameter{kanjiskip={0.10\zw plus 0.04\zw minus 0.02\zw}}組版情報}\par}",
        r"\smallskip",
        r"\noindent\textbf{── ファイル情報 ──}\par",
        rf"\noindent {file_line}\par",
        r"\smallskip",
        r"\noindent\textbf{── フォント設定 ──}\par",
        rf"\noindent {font_line}\par",
        r"\smallskip",
        r"\noindent\textbf{── レイアウト設定 ──}\par",
        rf"\noindent {layout_line_1}\par",
        rf"\noindent {layout_line_2}\par",
        r"\smallskip",
        r"\noindent\textbf{── 用紙・余白設定 ──}\par",
        rf"\noindent {paper_line}\par",
        r"\smallskip",
        r"\noindent\textbf{── 追加情報 ──}\par",
        rf"\noindent {extra_line_with_linespeed}\par",
        r"\smallskip",
        r"\noindent\textbf{── 手動コンパイル手順 ──}\par",
    ]

    for row in manual_rows:
        lines.append(rf"\noindent {row}\par")

    lines += [r"\endgroup"]
    return "\n".join(lines) + "\n"


# -----------------------
# tex ファイル生成
# -----------------------


def build_tex_file(
    latex_body: str,
    out_tex: Path,
    device: Optional[str] = None,
    font_override: Optional[str] = None,
    background_color: str = "#FFFFFF",
    text_color: str = "#000000",
    title: str = "タイトルをここに記入",
    author: str = "作者名をここに記入",
    okuduke_override: Optional[str] = None,
    html_path: Optional[Path] = None,
    main_washi_enabled: Optional[bool] = None,
    main_frame_enabled: Optional[bool] = None,
    main_frame_variant: Optional[int] = None,
    cover_texture_enabled: Optional[bool] = None,
    cover_texture_variant: Optional[int] = None,
    background_render_mode: Optional[str] = None,
    cover_image_path: Optional[str] = None,
    cover_image_opacity: Optional[float] = None,
    washi_image_path: Optional[str] = None,
    washi_image_opacity: Optional[float] = None,
    page_number_enabled: Optional[bool] = None,
    body_column_mode: Optional[str] = None,
    device_orientation: Optional[str] = None,
    use_default_settings: bool = False,
) -> Path:
    """
    本文（LaTeX中間）をテンプレートに埋め込み、`.tex` として保存します。

    ``%`` を使用する LaTeX テンプレートは ``%(key)s`` 形式のスタイル書式で埋め込みます
    （``str.format()`` は ``{`` ``}`` の出現が多いLaTeXでは使いづらいため避けています）。
    """
    device_name = device or "smart"
    include_custom = not use_default_settings
    font, font_size, spacing, character_spacing = get_pdf_settings(
        device_name,
        include_custom=include_custom,
    )
    device_layout = get_device_layout_settings(
        device_name,
        include_custom=include_custom,
    )
    width = float(device_layout["width_mm"])
    height = float(device_layout["height_mm"])
    if font_override:
        font = font_override

    # 本文段組は body_column_mode で制御する。
    docclass_extra = ""
    pre_info_layout = ""

    margin_top = float(device_layout["margin_top_mm"])
    margin_bottom = float(device_layout["margin_bottom_mm"])
    margin_left = float(device_layout["margin_left_mm"])
    margin_right = float(device_layout["margin_right_mm"])

    profile_orientation = str(device_layout.get("orientation", "portrait")).strip().lower()
    if profile_orientation not in settings_store.SUPPORTED_ORIENTATIONS:
        profile_orientation = "portrait"
    resolved_orientation = profile_orientation
    if device_orientation is not None:
        requested_orientation = str(device_orientation).strip().lower()
        if requested_orientation in settings_store.SUPPORTED_ORIENTATIONS:
            resolved_orientation = requested_orientation
    if resolved_orientation not in settings_store.SUPPORTED_ORIENTATIONS:
        resolved_orientation = "portrait"
    if (
        device_name in settings_store.DEVICE_ORIENTATION_OPTION_DEVICES
        and resolved_orientation != profile_orientation
    ):
        width, height = height, width
    device_layout["orientation"] = resolved_orientation

    global_settings = settings_store.get_global_settings(include_custom=include_custom)

    resolved_page_number_enabled = (
        bool(page_number_enabled)
        if page_number_enabled is not None
        else bool(global_settings.get("page_number_enabled", True))
    )
    resolved_body_column_mode = (
        str(
            body_column_mode
            if body_column_mode is not None
            else device_layout.get(
                "mode",
                global_settings.get("body_column_mode", "single_column"),
            )
        )
        .strip()
        .lower()
    )
    if resolved_body_column_mode not in {"single_column", "two_column"}:
        resolved_body_column_mode = "single_column"
    if (
        device_name == "tablet"
        and resolved_orientation == "landscape"
        and body_column_mode is None
    ):
        resolved_body_column_mode = "two_column"

    if device_name in {"smart"}:
        resolved_body_column_mode = "single_column"

    show_page_number = resolved_page_number_enabled
    if device_name in {"smart"}:
        show_page_number = False

    columns = 2 if resolved_body_column_mode == "two_column" else 1
    auto_chars = _compute_jis_characters_per_line(
        device_name=device_name,
        font_size=font_size,
        page_height_mm=height,
        margin_top_mm=margin_top,
        margin_bottom_mm=margin_bottom,
        character_spacing_zw=character_spacing,
    )
    lines_per_column = _compute_jis_lines_per_column(
        page_width_mm=width,
        margin_left_mm=margin_left,
        margin_right_mm=margin_right,
        font_size=font_size,
        line_leading_ratio=spacing,
        columns=columns,
    )
    pre_body_layout = (
        r"\twocolumn"
        if resolved_body_column_mode == "two_column"
        else ""
    )
    pre_okuduke_layout = (
        r"\clearpage\onecolumn"
        if resolved_body_column_mode == "two_column"
        else r"\clearpage"
    )

    # ---- JIS X 4051 準拠 レイアウト自動調整 ----
    # ルビサイズ: 本文フォントサイズの 1/2 (JIS X 4051 §6.2)
    # 字間: 漢字間 0zw（ベタ組）、和欧間 0.25zw
    # 行送り: S(1+k)（k はコード定義、既定 0.5）。相対単位で指定し font_size 変更に追従させる。
    # ルビ間隔: 0.1zh (ルビとルビ親文字の間)。ルビあり行・なし行で行間を均一化する。
    ruby_pt = font_size / 2.0
    font_size_tex = f"{font_size:g}"
    kanjiskip_expr = f"{character_spacing:.3f}\\zw plus 0.1pt minus 0.1pt"
    line_leading_zh_value = f"{float(spacing):.3f}".rstrip("0").rstrip(".")
    line_leading_tex = f"{line_leading_zh_value}\\zh"

    layout_tweak_lines = [
        # JIS 準拠字間（漢字間=0、和欧文間=0.25zw）
        "\\ltjsetparameter{kanjiskip={"
        + kanjiskip_expr
        + "},xkanjiskip={0.25\\zw plus 0.1\\zw minus 0.1\\zw}}",
        # JIS準拠行送り（S(1+k)）。相対単位で指定 → font_size 変更時に自動追従。
        # ルビあり行・なし行で行間が不均一になる問題を解消する。
        rf"\setlength{{\baselineskip}}{{{line_leading_tex}}}",
        # ルビフォントサイズを本文の1/2に設定
        # \providecommand で先に定義してから \renewcommand で上書き（パッケージ未定義エラー回避）
        r"\providecommand{\rubyfontsize}[1]{}",
        rf"\renewcommand{{\rubyfontsize}}[1]{{\fontsize{{{ruby_pt:.1f}pt}}{{{ruby_pt:.1f}pt}}\selectfont}}",
        # 既定の parindent は無効化し、HTML 内の実際の空白のみで字下げを表現する。
        r"\setlength{\parskip}{0pt}",
        r"\setlength{\parindent}{0pt}",
    ]
    if resolved_body_column_mode == "two_column":
        layout_tweak_lines.append(
            rf"\setlength{{\columnsep}}{{{line_leading_tex}}}"
        )

    layout_tweak = "\n".join(layout_tweak_lines)

    # 初期値（装飾設定解決後に上書きする）
    page_style_block = (
        r"\NewPageStyle{aozora}{nombre_position=bottom-center,nombre={}}" + "\n"
        r"\ModifyPageStyle{plain}{nombre_position=bottom-center,nombre={}}"
    )
    pagestyle_name = "empty"

    # HTML カラーコードから ``#`` を除いて渡す
    bg_color = _normalize_hex_color_for_latex(background_color, fallback="FFFFFF")
    fg_color = _normalize_hex_color_for_latex(text_color, fallback="000000")
    okuduke = (
        okuduke_override if okuduke_override is not None else load_okuduke_template()
    )

    resolved_main_washi_enabled = (
        bool(main_washi_enabled)
        if main_washi_enabled is not None
        else bool(global_settings.get("main_washi_enabled", False))
    )
    resolved_main_frame_enabled = (
        bool(main_frame_enabled)
        if main_frame_enabled is not None
        else bool(global_settings.get("main_frame_enabled", False))
    )
    main_frame_variant_raw = (
        main_frame_variant
        if main_frame_variant is not None
        else global_settings.get("main_frame_variant", 1)
    )
    try:
        main_frame_variant_value = int(main_frame_variant_raw)
    except (TypeError, ValueError):
        main_frame_variant_value = 1
    resolved_main_frame_variant = _normalize_variant(
        main_frame_variant_value, fallback=1
    )
    resolved_cover_texture_enabled = (
        bool(cover_texture_enabled)
        if cover_texture_enabled is not None
        else bool(global_settings.get("cover_texture_enabled", False))
    )
    cover_texture_variant_raw = (
        cover_texture_variant
        if cover_texture_variant is not None
        else global_settings.get("cover_texture_variant", 1)
    )
    try:
        cover_texture_variant_value = int(cover_texture_variant_raw)
    except (TypeError, ValueError):
        cover_texture_variant_value = 1
    resolved_cover_texture_variant = _normalize_variant(
        cover_texture_variant_value,
        fallback=1,
    )
    resolved_background_render_mode = _normalize_background_render_mode(
        (
            background_render_mode
            if background_render_mode is not None
            else global_settings.get("background_render_mode", "tikz")
        ),
        fallback="tikz",
    )
    resolved_cover_image_path = (
        str(cover_image_path).strip()
        if cover_image_path is not None
        else str(global_settings.get("cover_image_path", "")).strip()
    )
    resolved_washi_image_path = (
        str(washi_image_path).strip()
        if washi_image_path is not None
        else str(global_settings.get("washi_image_path", "")).strip()
    )
    resolved_cover_image_opacity = _normalize_background_opacity(
        (
            cover_image_opacity
            if cover_image_opacity is not None
            else global_settings.get(
                "cover_image_opacity",
                DEFAULT_COVER_IMAGE_OPACITY,
            )
        ),
        DEFAULT_COVER_IMAGE_OPACITY,
    )
    resolved_washi_image_opacity = _normalize_background_opacity(
        (
            washi_image_opacity
            if washi_image_opacity is not None
            else global_settings.get(
                "washi_image_opacity",
                DEFAULT_WASHI_IMAGE_OPACITY,
            )
        ),
        DEFAULT_WASHI_IMAGE_OPACITY,
    )

    # iPhone / Android は本文の Frame（フレーム・枠）を常に無効化する。
    frame_allowed_devices = {"pc", "tablet"}
    if device_name not in frame_allowed_devices:
        resolved_main_frame_enabled = False

    # ---- ページスタイル調整 ----
    # 本文字数は固定余白と組版値から算出し、装飾要素では変更しない。
    effective_chars = auto_chars
    if show_page_number:
        if resolved_main_frame_enabled:
            nombre_value = r"\raisebox{2.8mm}[0pt][0pt]{\small \thepage{} / \pageref*{LastBodyPage}}"
        else:
            nombre_value = r"\small \thepage{} / \pageref*{LastBodyPage}"

        page_style_block = (
            r"\NewPageStyle{aozora}{" + "\n"
            r"    nombre_position=bottom-center," + "\n"
            rf"    nombre={{{nombre_value}}}," + "\n"
            r"}" + "\n"
            r"\ModifyPageStyle{plain}{" + "\n"
            r"    nombre_position=bottom-center," + "\n"
            rf"    nombre={{{nombre_value}}}," + "\n"
            r"}"
        )
        pagestyle_name = "aozora"

    # ---- テンプレートブロックの生成 ----
    # Python 内に埋め込んだテンプレートをレンダリング
    frontcover_template = load_frontcover_template()
    typesetting_info_template = load_typesetting_info_template()
    main_text_template = load_main_text_template()
    colophon_template = load_colophon_template()
    washi_texture_template = load_washi_texture_template()
    cover_texture = load_cover_texture_template(resolved_cover_texture_variant)
    main_frame_texture = load_main_frame_template(resolved_main_frame_variant)
    cover_image_source = _resolve_background_asset_path(
        "cover",
        resolved_cover_image_path,
    )
    washi_image_source = _resolve_background_asset_path(
        "washi",
        resolved_washi_image_path,
    )
    staged_cover_image_path = (
        _stage_background_image(cover_image_source, out_tex, "cover")
        if cover_image_source is not None
        else ""
    )
    staged_washi_image_path = (
        _stage_background_image(washi_image_source, out_tex, "washi")
        if washi_image_source is not None
        else ""
    )

    cover_washi_texture = render_washi_texture_by_section(
        template_text=washi_texture_template,
        device=device_name,
        section="cover",
        page_width_mm=width,
        page_height_mm=height,
        base_bg_hex=bg_color,
    )
    typesetting_info_washi_texture = render_washi_texture_by_section(
        template_text=washi_texture_template,
        device=device_name,
        section="typesetting_info",
        page_width_mm=width,
        page_height_mm=height,
        base_bg_hex=bg_color,
    )
    main_washi_texture = render_washi_texture_by_section(
        template_text=washi_texture_template,
        device=device_name,
        section="main",
        page_width_mm=width,
        page_height_mm=height,
        base_bg_hex=bg_color,
    )
    colophon_washi_texture = render_washi_texture_by_section(
        template_text=washi_texture_template,
        device=device_name,
        section="colophon",
        page_width_mm=width,
        page_height_mm=height,
        base_bg_hex=bg_color,
    )

    # 組版情報ページを生成
    if html_path is not None:
        info_device_name = (
            f"{device_name} ({resolved_orientation})"
            if device_name in settings_store.DEVICE_ORIENTATION_OPTION_DEVICES
            else device_name
        )
        typesetting_info_body = build_info_page(
            html_path=html_path,
            font=font,
            font_size=font_size,
            chars=effective_chars,
            lines_per_column=lines_per_column,
            spacing=spacing,
            width=width,
            height=height,
            character_spacing=character_spacing,
            device=info_device_name,
            margin_top=margin_top,
            margin_bottom=margin_bottom,
            margin_left=margin_left,
            margin_right=margin_right,
            columns=columns,
            show_page_number=show_page_number,
        )
    else:
        typesetting_info_body = ""

    # 各ブロックのテンプレートをレンダリング
    cover_overlay_snippets: list[str] = []
    typesetting_info_overlay_snippets: list[str] = []
    main_overlay_snippets: list[str] = []
    colophon_overlay_snippets: list[str] = []

    if resolved_background_render_mode == "image":
        if resolved_main_washi_enabled and staged_washi_image_path:
            washi_image_overlay = _make_image_overlay_snippet(
                staged_washi_image_path,
                resolved_washi_image_opacity,
            )
            typesetting_info_overlay_snippets.append(washi_image_overlay)
            main_overlay_snippets.append(washi_image_overlay)
            colophon_overlay_snippets.append(washi_image_overlay)
            if not (resolved_cover_texture_enabled and staged_cover_image_path):
                cover_overlay_snippets.append(washi_image_overlay)
        if resolved_cover_texture_enabled and staged_cover_image_path:
            cover_overlay_snippets.append(
                _make_image_overlay_snippet(
                    staged_cover_image_path,
                    resolved_cover_image_opacity,
                )
            )
    else:
        if resolved_cover_texture_enabled and cover_texture:
            cover_overlay_snippets.append(cover_texture)
        if (
            resolved_main_washi_enabled
            and cover_washi_texture
            and not (resolved_cover_texture_enabled and cover_texture)
        ):
            cover_overlay_snippets.append(cover_washi_texture)
        if resolved_main_washi_enabled and typesetting_info_washi_texture:
            typesetting_info_overlay_snippets.append(typesetting_info_washi_texture)
        if resolved_main_washi_enabled and main_washi_texture:
            main_overlay_snippets.append(main_washi_texture)
        if resolved_main_washi_enabled and colophon_washi_texture:
            colophon_overlay_snippets.append(colophon_washi_texture)

    cover_texture_block = (
        _make_one_page_overlay_block("\n".join(cover_overlay_snippets))
        if cover_overlay_snippets
        else ""
    )
    colophon_texture_block = (
        _make_one_page_overlay_block("\n".join(colophon_overlay_snippets))
        if colophon_overlay_snippets
        else ""
    )
    colophon_frame_block = (
        _make_one_page_overlay_block(main_frame_texture)
        if resolved_main_frame_enabled and main_frame_texture
        else ""
    )
    typesetting_info_texture_block = (
        _make_one_page_overlay_block("\n".join(typesetting_info_overlay_snippets))
        if typesetting_info_overlay_snippets
        else ""
    )

    if resolved_main_frame_enabled and main_frame_texture:
        main_overlay_snippets.append(main_frame_texture)
    main_overlay_start = (
        _make_multi_page_overlay_start("\n".join(main_overlay_snippets))
        if main_overlay_snippets
        else ""
    )
    main_overlay_end = _make_multi_page_overlay_end(
        has_overlay=len(main_overlay_snippets) > 0
    )

    frontcover_block = render_template_block(
        frontcover_template,
        {
            "title": title,
            "author": author,
            "cover_texture_block": cover_texture_block,
        },
    )
    typesetting_info_block = render_template_block(
        typesetting_info_template,
        {
            "typesetting_info_body": typesetting_info_body,
            "typesetting_info_texture_block": typesetting_info_texture_block,
        },
    )
    main_text_block = render_template_block(
        main_text_template,
        {
            "pre_main_text_layout": pre_body_layout,
            "main_text_body": latex_body,
            "pagestyle_name": pagestyle_name,
            "main_overlay_start": main_overlay_start,
        },
    )
    colophon_block = render_template_block(
        colophon_template,
        {
            "colophon_body": okuduke,
            "colophon_texture_block": colophon_texture_block,
            "colophon_frame_block": colophon_frame_block,
            "main_overlay_end": main_overlay_end,
        },
    )

    content = LATEX_TEMPLATE_JLREQ_TATE % {
        "font": font,
        "font_size": font_size_tex,
        "docclass_extra": docclass_extra,
        "bg_color": bg_color,
        "fg_color": fg_color,
        "title": title,
        "author": author,
        "body": latex_body,
        "width": width,
        "height": height,
        "okuduke": okuduke,
        "layout_tweak": layout_tweak,
        "margin_left": margin_left,
        "margin_right": margin_right,
        "margin_top": margin_top,
        "margin_bottom": margin_bottom,
        "page_style_block": page_style_block,
        "pagestyle_name": pagestyle_name,
        "pre_body_layout": pre_body_layout,
        "pre_typesetting_info_layout": pre_info_layout,
        "pre_colophon_layout": pre_okuduke_layout,
        "frontcover_block": frontcover_block,
        "typesetting_info_block": typesetting_info_block,
        "main_text_block": main_text_block,
        "colophon_block": colophon_block,
        "washi_texture_block": "",
        "jigmo_coverage_lua": JIGMO_COVERAGE_LUA_FOR_PERCENT_TEMPLATE,
    }

    out_tex.write_text(content, encoding="utf-8")
    return out_tex


# -----------------------


def setup_logger(log_path: Path, verbose: bool) -> logging.Logger:
    """
    ログ出力を設定します。

    - ファイル: 常に DEBUG まで出す（変換失敗時の原因調査用）
    - コンソール: 通常は INFO、``--verbose`` のとき DEBUG
    """
    logger = logging.getLogger("aozoratex")
    logger.setLevel(logging.DEBUG)
    logger.handlers.clear()

    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")

    fh = logging.FileHandler(log_path, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.DEBUG if verbose else logging.INFO)
    ch.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    logger.addHandler(ch)

    return logger


# -----------------------
# CLI エントリポイント
# -----------------------


def main() -> None:
    from src.aozoratex_cli import run_cli

    run_cli()


if __name__ == "__main__":
    main()
