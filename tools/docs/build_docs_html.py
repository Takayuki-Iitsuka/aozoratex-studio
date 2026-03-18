#!/usr/bin/env python3
"""Convert all markdown files under docs/ into static HTML under static/docs/markdown/."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

import markdown


ROOT_DIR = Path(__file__).resolve().parents[2]
DOCS_SRC_DIR = ROOT_DIR / "docs"
DOCS_OUT_DIR = ROOT_DIR / "static" / "docs" / "markdown"

MD_LINK_PATTERN = re.compile(r"\]\(([^)#]+\.md)(#[^)]+)?\)", flags=re.IGNORECASE)
TITLE_PATTERN = re.compile(r"^\s*#\s+(.+?)\s*$", flags=re.MULTILINE)
LEGACY_TERM_MAP = {
    # 旧設定説明を現行の config/*.ini 体系へ寄せる
    "settings.ini": "config/*.ini",
    "washi_theme_enabled": "main_washi_enabled",
    "android_legacy": "android",
}


@dataclass(frozen=True)
class DocEntry:
    source: Path
    relative_md: Path
    output_html: Path
    title: str


def normalize_md_links(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        target = (match.group(1) or "").strip()
        frag = match.group(2) or ""

        # 外部リンクや独自スキームは変換しない
        if "://" in target:
            return match.group(0)

        out = target[:-3] + ".html"
        return "](" + out + frag + ")"

    return MD_LINK_PATTERN.sub(repl, text)


def normalize_legacy_terms(text: str) -> str:
    normalized = text
    for before, after in LEGACY_TERM_MAP.items():
        normalized = normalized.replace(before, after)
    return normalized


def extract_title(text: str, fallback: str) -> str:
    found = TITLE_PATTERN.search(text)
    if not found:
        return fallback
    title = found.group(1).strip()
    return title or fallback


def render_html(title: str, body_html: str, relative_md: Path) -> str:
    source_label = relative_md.as_posix()
    return f"""<!DOCTYPE html>
<html lang=\"ja\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>{title}</title>
  <link rel=\"stylesheet\" href=\"/static/docs/docs-common.css\">
</head>
<body>
  <main class=\"doc-wrap\">
    <p><a href=\"/static/docs/markdown/index.html\">Markdown変換ドキュメント一覧へ戻る</a></p>
    <p class=\"muted\">source: {source_label}</p>
    {body_html}
  </main>
</body>
</html>
"""


def render_index(entries: list[DocEntry]) -> str:
    manuals = [
        entry for entry in entries if entry.relative_md.parts[:1] == ("manuals",)
    ]
    technical = [
        entry for entry in entries if entry.relative_md.parts[:1] == ("technical",)
    ]
    root_docs = [
        entry
        for entry in entries
        if entry.relative_md.parts[:1] not in (("manuals",), ("technical",))
    ]

    def build_list(items: list[DocEntry]) -> str:
        if not items:
            return "<p>対象なし</p>"
        lines = ["<ul>"]
        for item in sorted(items, key=lambda it: it.relative_md.as_posix()):
            link = item.output_html.relative_to(ROOT_DIR / "static" / "docs").as_posix()
            rel = item.relative_md.as_posix()
            lines.append(
                f'<li><a href="/static/docs/{link}">{item.title}</a><br><small>{rel}</small></li>'
            )
        lines.append("</ul>")
        return "\n".join(lines)

    return f"""<!DOCTYPE html>
<html lang=\"ja\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>Markdown変換ドキュメント一覧</title>
  <link rel=\"stylesheet\" href=\"/static/docs/docs-common.css\">
</head>
<body>
  <main class=\"doc-wrap\">
    <h1>Markdown変換ドキュメント一覧</h1>
    <p>docs 配下の Markdown を自動変換した一覧です。</p>
    <p><a href=\"/static/docs/index.html\">ドキュメントトップへ戻る</a></p>

    <h2>root</h2>
    {build_list(root_docs)}

    <h2>manuals</h2>
    {build_list(manuals)}

    <h2>technical</h2>
    {build_list(technical)}
  </main>
</body>
</html>
"""


def collect_docs() -> list[DocEntry]:
    entries: list[DocEntry] = []
    for path in sorted(DOCS_SRC_DIR.rglob("*.md")):
        rel = path.relative_to(DOCS_SRC_DIR)
        out = DOCS_OUT_DIR / rel.with_suffix(".html")
        text = path.read_text(encoding="utf-8")
        title = extract_title(text, rel.stem)
        entries.append(
            DocEntry(source=path, relative_md=rel, output_html=out, title=title)
        )
    return entries


def convert_docs(entries: list[DocEntry]) -> None:
    for entry in entries:
        entry.output_html.parent.mkdir(parents=True, exist_ok=True)

        src = entry.source.read_text(encoding="utf-8")
        normalized = normalize_legacy_terms(normalize_md_links(src))
        converter = markdown.Markdown(
            extensions=[
                "tables",
                "fenced_code",
                "toc",
                "sane_lists",
                "attr_list",
                "md_in_html",
            ]
        )
        html_body = converter.convert(normalized)
        full_html = render_html(entry.title, html_body, entry.relative_md)
        entry.output_html.write_text(full_html, encoding="utf-8")


def main() -> None:
    entries = collect_docs()
    DOCS_OUT_DIR.mkdir(parents=True, exist_ok=True)
    convert_docs(entries)
    index_html = render_index(entries)
    (DOCS_OUT_DIR / "index.html").write_text(index_html, encoding="utf-8")

    print(f"Converted {len(entries)} markdown files")
    print(f"Output: {DOCS_OUT_DIR}")


if __name__ == "__main__":
    main()
