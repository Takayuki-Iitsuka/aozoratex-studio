#!/usr/bin/env python3
"""
Collect LuaLaTeX-usable fonts on this machine and export a CSV.

Project-oriented behavior:
- Uses `fc-list` (TeX Live / fontconfig) as the source of truth.
- Generates a lightweight CSV used by AozoraTeX Studio settings work.
- Marks Japanese-candidate fonts and recommendation hints.
"""

from __future__ import annotations

import argparse
import csv
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DEFAULT = Path(__file__).resolve().parent / "texlive_fonts.csv"

FC_LIST_CANDIDATES = (
    r"C:\texlive\2026\bin\windows\fc-list.exe",
    r"C:\texlive\2026\bin\win32\fc-list.exe",
    "fc-list",
)

JP_KEYWORDS_STRICT = (
    "ipa",
    "ipaex",
    "ipamj",
    "yu mincho",
    "yu gothic",
    "meiryo",
    "hiragino",
    "ms mincho",
    "ms gothic",
    "biz ud",
    "udgothic",
    "udmincho",
    "source han",
    "harano aji",
    "noto serif jp",
    "noto sans jp",
    "noto serif cjk",
    "noto sans cjk",
    "kozuka",
    "gen shin",
    "gen jyuu",
    "genei",
    "honoka",
)

JP_PATH_KEYWORDS = (
    "ipa",
    "ipaex",
    "ipamj",
    "yumin",
    "yugoth",
    "meiryo",
    "msgothic",
    "msmincho",
    "sourcehan",
    "haranoaji",
    "hiragino",
    "bizud",
    "udgothic",
    "udmincho",
)

JP_CJK_PATTERN = re.compile(r"[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]")
JP_STYLE_CONTEXT_PATTERN = re.compile(
    r"(mincho|minchou|gothic)",
    re.IGNORECASE,
)
JP_STYLE_GUARD_PATTERN = re.compile(
    r"(yu|ipa|biz|ud|source\s*han|noto|harano|meiryo|hiragino|ms\s*|gen|honoka|jpan|japanese|cjk)",
    re.IGNORECASE,
)

RECOMMEND_KEYWORDS = (
    "yu mincho",
    "ipaexmincho",
    "ipamincho",
    "ipamjmincho",
    "ipa mincho",
    "hiragino mincho",
    "source han serif",
    "noto serif cjk",
)

FC_FORMAT = "%{family}\\t%{style}\\t%{file}\\n"

STYLE_PRIORITY = {
    "regular": 0,
    "book": 1,
    "roman": 1,
    "medium": 2,
    "normal": 2,
    "semibold": 3,
    "demibold": 3,
    "bold": 4,
    "heavy": 5,
    "black": 6,
    "light": 7,
    "extralight": 8,
    "thin": 9,
}


@dataclass(frozen=True)
class FontRow:
    family: str
    style: str
    file_path: str
    japanese_candidate: bool
    recommended: bool
    latex_name: str
    latex_command: str


def find_fc_list() -> str | None:
    for candidate in FC_LIST_CANDIDATES:
        path = Path(candidate)
        if path.exists():
            return str(path)
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    return None


def is_japanese_candidate(family: str, file_path: str) -> bool:
    family_l = family.lower().strip()
    path_l = file_path.lower().strip()
    haystack = f"{family_l} {path_l}"

    # 日本語名フォントは CJK 文字の存在で直接判定する。
    if JP_CJK_PATTERN.search(family):
        return True

    if any(keyword in family_l for keyword in JP_KEYWORDS_STRICT):
        return True

    if any(keyword in path_l for keyword in JP_PATH_KEYWORDS):
        return True

    # "Gothic/Mincho" のみは誤検出が多いので、和文文脈キーワードを同時に要求する。
    if JP_STYLE_CONTEXT_PATTERN.search(haystack) and JP_STYLE_GUARD_PATTERN.search(
        haystack
    ):
        return True

    return False


def is_recommended(family: str) -> bool:
    name = family.lower()
    return any(keyword in name for keyword in RECOMMEND_KEYWORDS)


def to_latex_command(family: str, japanese_candidate: bool) -> str:
    if japanese_candidate:
        return f"\\setmainjfont{{{family}}}"
    return f"\\setmainfont{{{family}}}"


def decode_fc_output(raw: bytes) -> str:
    for encoding in ("utf-8", "cp932"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def style_sort_key(style: str) -> tuple[int, str]:
    normalized = style.lower().replace(" ", "")
    return (STYLE_PRIORITY.get(normalized, 99), style.lower())


def iter_fonts(fc_list_path: str) -> Iterable[FontRow]:
    proc = subprocess.run(
        [fc_list_path, "--format", FC_FORMAT],
        capture_output=True,
        timeout=120,
        check=False,
    )
    stdout_text = decode_fc_output(proc.stdout)
    stderr_text = decode_fc_output(proc.stderr)
    if proc.returncode != 0:
        raise RuntimeError(stderr_text.strip() or "fc-list failed")

    seen: set[tuple[str, str, str]] = set()

    for line in stdout_text.splitlines():
        parts = line.strip().split("\t")
        if len(parts) < 3:
            continue
        family_raw, style_raw, file_path = parts[:3]
        families = [item.strip() for item in family_raw.split(",") if item.strip()]
        style = style_raw.split(",")[0].strip() if style_raw else "Regular"

        if not families:
            continue

        family = families[0]
        key = (family, style, file_path)
        if key in seen:
            continue
        seen.add(key)

        jp = is_japanese_candidate(family, file_path)
        yield FontRow(
            family=family,
            style=style,
            file_path=file_path,
            japanese_candidate=jp,
            recommended=is_recommended(family),
            latex_name=family,
            latex_command=to_latex_command(family, jp),
        )


def write_csv(rows: list[FontRow], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "family",
                "style",
                "file_path",
                "japanese_candidate",
                "recommended_for_aozoratex",
                "latex_name",
                "latex_command",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row.family,
                    row.style,
                    row.file_path,
                    "true" if row.japanese_candidate else "false",
                    "true" if row.recommended else "false",
                    row.latex_name,
                    row.latex_command,
                ]
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export LuaLaTeX-usable fonts into CSV for AozoraTeX Studio."
    )
    parser.add_argument(
        "--output",
        default=str(OUTPUT_DEFAULT),
        help=f"output CSV path (default: {OUTPUT_DEFAULT})",
    )
    parser.add_argument(
        "--japanese-only",
        action="store_true",
        help="include only japanese_candidate=true rows",
    )
    args = parser.parse_args()

    fc_list = find_fc_list()
    if not fc_list:
        print("ERROR: fc-list not found. Please check TeX Live/fontconfig PATH.")
        sys.exit(1)

    rows = sorted(
        list(iter_fonts(fc_list)),
        key=lambda x: (
            0 if x.recommended else 1,
            0 if x.japanese_candidate else 1,
            x.family.lower(),
            style_sort_key(x.style),
        ),
    )
    if args.japanese_only:
        rows = [row for row in rows if row.japanese_candidate]

    output_path = Path(args.output).resolve()
    write_csv(rows, output_path)

    jp_count = sum(1 for row in rows if row.japanese_candidate)
    print(
        "Exported "
        f"{len(rows)} fonts "
        f"(japanese candidates: {jp_count})"
    )
    print(f"CSV: {output_path}")


if __name__ == "__main__":
    main()
