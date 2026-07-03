#!/usr/bin/env python3
"""
Parse TeX log files and export readable reports for this project.

Outputs:
- Markdown summary: out/reports/tex_logs/<log_name>.summary.md
- JSON summary:     out/reports/tex_logs/<log_name>.summary.json
"""

from __future__ import annotations

import argparse
import glob
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

ROOT_DIR = Path(__file__).resolve().parents[2]
REPORT_DIR_DEFAULT = ROOT_DIR / "out" / "reports" / "tex_logs"

PATTERN_ERROR = re.compile(r"(^!.*|.*\bError:.*)", re.IGNORECASE)
PATTERN_WARNING = re.compile(r".*\bWarning:.*", re.IGNORECASE)
PATTERN_BAD_BOX = re.compile(r".*(Overfull|Underfull)\s+\\[hv]box.*", re.IGNORECASE)
PATTERN_MISSING_CHAR = re.compile(r".*Missing character:.*", re.IGNORECASE)
PATTERN_FILE_LINE = re.compile(r"([^\s:]+\.tex):(\d+):")


@dataclass(frozen=True)
class LogItem:
    line: int
    text: str
    source_file: str = ""
    source_line: int = 0


@dataclass(frozen=True)
class ParseResult:
    log_file: str
    errors: list[LogItem]
    warnings: list[LogItem]
    bad_boxes: list[LogItem]
    missing_chars: list[LogItem]


def _extract_source_location(text: str) -> tuple[str, int]:
    m = PATTERN_FILE_LINE.search(text)
    if not m:
        return "", 0
    return m.group(1), int(m.group(2))


def parse_log_file(path: Path) -> ParseResult:
    errors: list[LogItem] = []
    warnings: list[LogItem] = []
    bad_boxes: list[LogItem] = []
    missing_chars: list[LogItem] = []

    with path.open("r", encoding="utf-8", errors="ignore") as fh:
        for line_number, raw in enumerate(fh, 1):
            text = raw.strip()
            if not text:
                continue

            src_file, src_line = _extract_source_location(text)
            item = LogItem(
                line=line_number,
                text=text,
                source_file=src_file,
                source_line=src_line,
            )

            if PATTERN_ERROR.match(text):
                errors.append(item)
            elif PATTERN_WARNING.match(text):
                warnings.append(item)
            elif PATTERN_BAD_BOX.match(text):
                bad_boxes.append(item)
            elif PATTERN_MISSING_CHAR.match(text):
                missing_chars.append(item)

    return ParseResult(
        log_file=str(path),
        errors=errors,
        warnings=warnings,
        bad_boxes=bad_boxes,
        missing_chars=missing_chars,
    )


def _format_item(item: LogItem) -> str:
    if item.source_file:
        return (
            f"- line {item.line} ({item.source_file}:{item.source_line}): "
            f"`{item.text}`"
        )
    return f"- line {item.line}: `{item.text}`"


def build_markdown(result: ParseResult) -> str:
    def section(title: str, items: list[LogItem]) -> list[str]:
        lines = [f"## {title}", ""]
        if not items:
            lines.append("- none")
            lines.append("")
            return lines
        lines.extend(_format_item(item) for item in items)
        lines.append("")
        return lines

    lines = [
        "# TeX Log Summary",
        "",
        f"- source: `{result.log_file}`",
        f"- errors: **{len(result.errors)}**",
        f"- warnings: **{len(result.warnings)}**",
        f"- bad boxes: **{len(result.bad_boxes)}**",
        f"- missing characters: **{len(result.missing_chars)}**",
        "",
    ]
    lines.extend(section("Errors", result.errors))
    lines.extend(section("Warnings", result.warnings))
    lines.extend(section("Bad Boxes", result.bad_boxes))
    lines.extend(section("Missing Characters", result.missing_chars))
    return "\n".join(lines)


def _result_to_json_dict(result: ParseResult) -> dict:
    return {
        "log_file": result.log_file,
        "errors": [asdict(item) for item in result.errors],
        "warnings": [asdict(item) for item in result.warnings],
        "bad_boxes": [asdict(item) for item in result.bad_boxes],
        "missing_chars": [asdict(item) for item in result.missing_chars],
    }


def _expand_targets(targets: list[str]) -> Iterable[Path]:
    for target in targets:
        matches = glob.glob(target) if ("*" in target or "?" in target) else [target]
        for match in matches:
            path = Path(match).resolve()
            if path.exists() and path.is_file():
                yield path


def _report_paths(log_path: Path, output_dir: Path) -> tuple[Path, Path]:
    safe_name = log_path.stem
    md = output_dir / f"{safe_name}.summary.md"
    js = output_dir / f"{safe_name}.summary.json"
    return md, js


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse TeX logs into readable reports.")
    parser.add_argument("targets", nargs="+", help="log files or globs")
    parser.add_argument(
        "--output-dir",
        default=str(REPORT_DIR_DEFAULT),
        help=f"report output directory (default: {REPORT_DIR_DEFAULT})",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    found = list(_expand_targets(args.targets))
    if not found:
        print("No matching log files were found.")
        raise SystemExit(1)

    for path in found:
        result = parse_log_file(path)
        md_path, json_path = _report_paths(path, output_dir)

        md_path.write_text(build_markdown(result), encoding="utf-8")
        json_path.write_text(
            json.dumps(_result_to_json_dict(result), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        print(
            f"{path.name}: errors={len(result.errors)}, warnings={len(result.warnings)}, "
            f"bad_boxes={len(result.bad_boxes)}, missing_chars={len(result.missing_chars)}"
        )
        print(f"  markdown: {md_path}")
        print(f"  json:     {json_path}")


if __name__ == "__main__":
    main()

