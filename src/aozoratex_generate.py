from __future__ import annotations

"""Thin generation facade shared by Web API and future batch jobs."""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from src import aozoratex


@dataclass(frozen=True, slots=True)
class TexGenerationResult:
    """Generation outputs needed by the Web API response."""

    tex_file: Path
    encoding_used: str
    title: str
    author: str


def generate_tex_for_source(
    source_path: Path,
    out_dir: Path,
    *,
    device: str,
    parser: str = "html.parser",
    preferred_encoding: Optional[str] = None,
    font_override: Optional[str] = None,
    background_color: str = "#FFFFFF",
    text_color: str = "#000000",
    main_washi_enabled: Optional[bool] = None,
    main_frame_enabled: Optional[bool] = None,
    main_frame_variant: Optional[int] = None,
    cover_texture_enabled: Optional[bool] = None,
    cover_texture_variant: Optional[int] = None,
) -> TexGenerationResult:
    """
    Convert one local HTML/XHTML source into a `.tex` file.

    Notes for customization:
    - `device` controls size/layout profile selection
    - color/decorations are passed through to `build_tex_file`
    - this function intentionally does not compile PDF
    """
    html, encoding_used = aozoratex.fetch_html_local(
        str(source_path),
        preferred_encoding=preferred_encoding,
    )
    body = aozoratex.html_to_latex_body(html, parser=parser)
    raw_title, raw_author = aozoratex.extract_title_author_raw(html, parser=parser)
    title = aozoratex.escape_latex(raw_title)
    author = aozoratex.escape_latex(raw_author)
    okuduke = aozoratex.build_okuduke_from_html(html, parser=parser)
    output_stem = aozoratex.build_output_stem(source_path, raw_title, raw_author)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_tex = out_dir / f"{output_stem}.tex"
    aozoratex.build_tex_file(
        latex_body=body,
        out_tex=out_tex,
        device=device,
        font_override=font_override,
        background_color=background_color,
        text_color=text_color,
        title=title,
        author=author,
        okuduke_override=okuduke,
        html_path=source_path,
        main_washi_enabled=main_washi_enabled,
        main_frame_enabled=main_frame_enabled,
        main_frame_variant=main_frame_variant,
        cover_texture_enabled=cover_texture_enabled,
        cover_texture_variant=cover_texture_variant,
    )

    return TexGenerationResult(
        tex_file=out_tex,
        encoding_used=encoding_used,
        title=raw_title,
        author=raw_author,
    )
