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
"""

# ---- 標準ライブラリ ----
import argparse
import logging
import re
import sys
import warnings
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Optional

# ---- サードパーティ ----
from bs4 import BeautifulSoup, Tag, XMLParsedAsHTMLWarning
from bs4.element import NavigableString

from src import settings_store

# ---- 定数 ----
WORKDIR = Path(__file__).resolve().parent.parent
LATEX_TEMPLATE_DIR = WORKDIR / "latex_templates"
FRONTCOVER_TEMPLATE_FILE = LATEX_TEMPLATE_DIR / "FrontCover.tex"
TYPESETTING_INFO_TEMPLATE_FILE = LATEX_TEMPLATE_DIR / "Typesetting_info.tex"
MAIN_TEXT_TEMPLATE_FILE = LATEX_TEMPLATE_DIR / "Main_text.tex"
COLOPHON_TEMPLATE_FILE = LATEX_TEMPLATE_DIR / "Colophon.tex"
WASHI_TEXTURE_TEMPLATE_FILE = LATEX_TEMPLATE_DIR / "washi_texture.tex"
COVER_TEXTURE_TEMPLATE_FILES: dict[int, Path] = {
    1: LATEX_TEMPLATE_DIR / "FrontCover_texture1.tex",
    2: LATEX_TEMPLATE_DIR / "FrontCover_texture2.tex",
    3: LATEX_TEMPLATE_DIR / "FrontCover_texture3.tex",
}
MAIN_FRAME_TEMPLATE_FILES: dict[int, Path] = {
    1: LATEX_TEMPLATE_DIR / "Main_Frame1.tex",
    2: LATEX_TEMPLATE_DIR / "Main_Frame2.tex",
    3: LATEX_TEMPLATE_DIR / "Main_Frame3.tex",
}

# よく使う青空外字注記のうち、Unicode へ安全に置換できるもの
GAIJI_ALT_TO_UNICODE: dict[str, str] = {
    "特のへん＋廴＋聿": "犍",
}


# -----------------------
# 設定ファイル読み込み
# -----------------------


def get_pdf_size(device: Optional[str] = None) -> tuple[float, float]:
    """デバイス名から用紙サイズ (width, height) mm を返す。"""
    device_name = device or "iphone"
    profile = settings_store.get_device_settings(device_name)
    return float(profile["width_mm"]), float(profile["height_mm"])


def get_pdf_settings(
    device: Optional[str] = None,
) -> tuple[str, int, int, float, float]:
    """
    設定ファイルからフォント・レイアウト設定を取得する。

    戻り値: (font, font_size, characters_per_line, line_spacing, character_spacing)
    """
    device_name = device or "iphone"
    global_settings = settings_store.get_global_settings()
    profile = settings_store.get_device_settings(device_name)

    font = str(global_settings["font_family"])
    font_size = int(profile["font_size"])
    characters_per_line = int(profile["characters_per_line"])
    line_spacing = float(profile["line_spacing"])
    character_spacing = float(profile["character_spacing"])
    return font, font_size, characters_per_line, line_spacing, character_spacing


def get_device_layout_settings(device: Optional[str] = None) -> dict[str, Any]:
    return settings_store.get_device_settings(device or "iphone")


def get_color_settings(mode: str) -> tuple[str, str]:
    """
    設定ファイルからカラーモード設定を取得する。

    戻り値: (background_color, text_color)  — 例: ("#FFFFFF", "#000000")
    """
    return settings_store.get_mode_colors(mode)


def resolve_color_mode(device: str, mode_override: Optional[str] = None) -> str:
    return settings_store.resolve_color_mode(device, mode_override)


def save_current_settings(
    device: str,
    mode: str,
    background_color: str,
    text_color: str,
    font_override: Optional[str] = None,
) -> None:
    global_updates: dict[str, Any] = {
        "color_mode": mode,
        "background_color": background_color,
        "text_color": text_color,
        f"background_color_{mode}": background_color,
        f"text_color_{mode}": text_color,
    }
    if font_override:
        global_updates["font_family"] = font_override

    device_updates = {device: {"color_mode": mode}}
    settings_store.save_settings(
        {
            "global": global_updates,
            "devices": device_updates,
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
        # ★修正: gaiji 判定は class リストで行う（node.attrs のキー存在チェックではない）
        if "gaiji" in classes:
            gaiji_unicode = _gaiji_alt_to_unicode(alt)
            if gaiji_unicode:
                return escape_latex(gaiji_unicode)
            return (
                r"\AozoraGaiji{"
                + escape_latex(src_norm)
                + "}{"
                + escape_latex(alt)
                + "}"
            )
        return (
            r"\AozoraImage{" + escape_latex(src_norm) + "}{" + escape_latex(alt) + "}"
        )

    if name in ("h1", "h2"):
        inner = "".join(convert_node(c) for c in node.contents).strip()
        return (r"\AozoraTitle{" + inner + "}" + "\n\n") if inner else ""

    if name in ("h3", "h4", "h5", "h6"):
        inner = "".join(convert_node(c) for c in node.contents).strip()
        return (r"\AozoraMidashi{" + inner + "}" + "\n\n") if inner else ""

    if name in ("div", "span", "section", "article"):
        # 字下げ（例: class="jisage_8" → 8字下げ）
        jisage: Optional[int] = None
        for cls in classes:
            m = re.fullmatch(r"jisage_(\d+)", cls)
            if m:
                jisage = int(m.group(1))
                break
        inner = "".join(convert_node(c) for c in node.contents)
        if jisage is not None:
            return r"\AozoraJisage{" + str(jisage) + "}{" + inner + "}" + "\n"
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
    4. 余分な空白/改行を軽く正規化
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
        if isinstance(child, Tag) and _is_block_break(child):
            parts.append("\n")

    body = "".join(parts)
    body = re.sub(r"[ \t]+\n", "\n", body)
    body = re.sub(r"\n{3,}", "\n\n", body).strip() + "\n"
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
  {{\ltjsetparameter{kanjiskip={0.12\zw plus 0.05\zw minus 0.02\zw}}\Huge \textbf{{{title}}}}} \\[1.5cm]
  {{\ltjsetparameter{kanjiskip={0.10\zw plus 0.04\zw minus 0.02\zw}}\Large {{{author}}}}}
  \vspace*{\fill}
\end{titlepage}
"""

DEFAULT_TYPESETTING_INFO_TEMPLATE = r"""%% ---- Typesetting_info ----
\newpage
{{typesetting_info_body}}
"""

DEFAULT_MAIN_TEXT_TEMPLATE = r"""%% ---- Main_text ----
\clearpage
\setcounter{page}{1}
\pagestyle{{{pagestyle_name}}}
{{pre_main_text_layout}}
{{main_overlay_start}}
{{main_text_body}}
{{main_overlay_end}}
\label{LastBodyPage}
"""

DEFAULT_COLOPHON_TEMPLATE = r"""%% ---- Colophon ----
\clearpage
{{colophon_texture_block}}
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


def _load_text_template(path: Path, fallback: str) -> str:
    if path.exists():
        text = path.read_text(encoding="utf-8").strip()
        if text:
            return text + "\n"
    return fallback.strip() + "\n"


def render_template_block(template_text: str, values: dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        return values.get(match.group(1), "")

    rendered = TEMPLATE_KEY_PATTERN.sub(repl, template_text)
    if not rendered.endswith("\n"):
        rendered += "\n"
    return rendered


def load_frontcover_template() -> str:
    return _load_text_template(FRONTCOVER_TEMPLATE_FILE, DEFAULT_FRONTCOVER_TEMPLATE)


def load_typesetting_info_template() -> str:
    return _load_text_template(
        TYPESETTING_INFO_TEMPLATE_FILE,
        DEFAULT_TYPESETTING_INFO_TEMPLATE,
    )


def load_main_text_template() -> str:
    return _load_text_template(MAIN_TEXT_TEMPLATE_FILE, DEFAULT_MAIN_TEXT_TEMPLATE)


def load_colophon_template() -> str:
    return _load_text_template(COLOPHON_TEMPLATE_FILE, DEFAULT_COLOPHON_TEMPLATE)


def load_washi_texture_template() -> str:
    return _load_text_template(WASHI_TEXTURE_TEMPLATE_FILE, "")


WASHI_DEVICE_PROFILES: dict[str, dict[str, float]] = {
    "iphone": {
        "patch_density": 0.00020,
        "fiber_density": 0.00750,
        "speck_density": 0.01300,
        "fiber_len_min": 4.0,
        "fiber_len_max": 14.0,
        "fiber_bend_max": 2.4,
        "laid_step_x": 5.0,
        "laid_step_y": 10.0,
    },
    "android": {
        "patch_density": 0.00022,
        "fiber_density": 0.00780,
        "speck_density": 0.01350,
        "fiber_len_min": 4.5,
        "fiber_len_max": 15.0,
        "fiber_bend_max": 2.6,
        "laid_step_x": 6.0,
        "laid_step_y": 10.0,
    },
    "ipad": {
        "patch_density": 0.00018,
        "fiber_density": 0.00620,
        "speck_density": 0.01100,
        "fiber_len_min": 6.0,
        "fiber_len_max": 20.0,
        "fiber_bend_max": 3.3,
        "laid_step_x": 7.0,
        "laid_step_y": 11.0,
    },
    "ipad_landscape": {
        "patch_density": 0.00018,
        "fiber_density": 0.00600,
        "speck_density": 0.01050,
        "fiber_len_min": 6.5,
        "fiber_len_max": 21.0,
        "fiber_bend_max": 3.5,
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
) -> dict[str, str]:
    device_profile = WASHI_DEVICE_PROFILES.get(device, WASHI_DEVICE_PROFILES["iphone"])
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
) -> str:
    if not template_text.strip():
        return ""
    values = _build_washi_render_values(
        device=device,
        section=section,
        page_width_mm=page_width_mm,
        page_height_mm=page_height_mm,
    )
    return render_template_block(template_text, values).strip()


def _normalize_variant(variant: Optional[int], fallback: int = 1) -> int:
    if variant in (1, 2, 3):
        return int(variant)
    return fallback


def load_cover_texture_template(variant: int) -> str:
    path = COVER_TEXTURE_TEMPLATE_FILES.get(_normalize_variant(variant), Path(""))
    if path and path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


def load_main_frame_template(variant: int) -> str:
    path = MAIN_FRAME_TEMPLATE_FILES.get(_normalize_variant(variant), Path(""))
    if path and path.exists():
        return path.read_text(encoding="utf-8").strip()
    return ""


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
    Colophon (奥付) テンプレートを読み込む。
    ファイルが存在しなければ既定値を返す。
    """
    return load_colophon_template()


def build_okuduke_from_html(html: str, parser: str = "html.parser") -> str:
    """
    HTML から奥付本文を抽出して LaTeX 形式で生成する。
    build_colophon_body_from_html のエイリアス。
    """
    return build_colophon_body_from_html(html, parser=parser)


LATEX_TEMPLATE_JLREQ_TATE = r"""\documentclass[%(font_size)spt,paper={%(width)smm,%(height)smm},tate%(docclass_extra)s,line_length=%(chars)szw]{jlreq}
\usepackage{luatexja}
\usepackage{luatexja-fontspec}
\usepackage{luatexja-ruby}
\usepackage{graphicx}
\usepackage[unicode=true,pdfpagelayout=SinglePage]{hyperref}
\usepackage{xcolor}
\usepackage{eso-pic}
\usepackage{tikz}
\usepackage{lltjext}
\usetikzlibrary{calc}
\usepackage[top=%(margin_top)smm,bottom=%(margin_bottom)smm,left=%(margin_left)smm,right=%(margin_right)smm]{geometry}
\linespread{%(spacing)s}

%% ---- ページめくり方向（横送り: 右→左）----
%% PDF ビューアに縦書き横送りを推奨する（対応ビューアのみ有効）
\pdfcatalog{/PageLayout /SinglePage /ViewerPreferences << /Direction /L2R >>}

%% ---- カラー設定 ----
\pagecolor[HTML]{%(bg_color)s}
\color[HTML]{%(fg_color)s}

%% ---- ページスタイル (jlreq 内蔵 nombre を使用) ----
%% スマホデバイスはページ番号なし（show_page_number=0 のとき）
%(page_style_block)s

%% ---- Aozora helpers ----
\newcommand{\AozoraTitle}[1]{\begin{center}\Large #1\end{center}}
\newcommand{\AozoraMidashi}[1]{\par\bigskip\noindent\textbf{#1}\par\smallskip}
\newcommand{\bouten}[1]{#1}%% 必要なら傍点用に差し替え
\newcommand{\AozoraJisage}[2]{\par\noindent\hspace*{#1\zw}#2\par}

%% 外字/画像（src はHTMLの相対パスのまま出す）
\newcommand{\AozoraGaiji}[2]{%%
  \IfFileExists{#1}{\raisebox{0pt}{\includegraphics[height=1em]{#1}}}{[GAIJI]}%%
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
    font_size: int,
    chars: int,
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
    - レイアウト設定（列数・字数・文字サイズ / 字間・行間・行送り）
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
    char_size_mm = font_size * 0.35278
    line_height_mm = char_size_mm * 1.7
    ruby_pt = font_size / 2.0

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
            rf"本文サイズ：{font_size}pt",
            rf"ルビサイズ：{ruby_pt:.1f}pt",
        ]
    )
    # レイアウト設定：列数・字数・文字サイズは一行、行間・行送りは次の行
    layout_line_1 = " ・ ".join(
        [
            rf"本文列数：{columns}列",
            rf"一行の字数：{chars}字",
            rf"一文字サイズ（1zw）：{char_size_mm:.2f}mm",
        ]
    )
    layout_line_2 = " ・ ".join(
        [
            rf"字間（kanjiskip）：{character_spacing:.3f}zw",
            rf"行間（linespread）：{spacing}",
            rf"行送り（JIS 1.7zh）：約{line_height_mm:.2f}mm",
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
        r"外字処理：Unicode置換 + 画像フォールバック",
    ]
    extra_line = " ・ ".join(extra_parts)
    extra_line_with_linespeed = (
        extra_line + r" ・ 行送り基準：\texttt{\setlength{\baselineskip}{1.7\zh}}"
    )

    manual_rows = [
        "1. texファイル生成：",
        r"\quad\texttt{python aozoratex.py data/ -{}-device iphone -{}-mode light -{}-out out/iphone}",
        "2. PDF化（latexmkで自動コンパイル）：",
        r"\quad\texttt{latexmk -lualatex -interaction=nonstopmode -file-line-error -halt-on-error -silent -use-make -outdir=out/iphone out/iphone/file.tex}",
    ]

    lines = [
        r"\begingroup",
        r"\scriptsize",
        r"\setlength{\parindent}{0pt}",
        r"\setlength{\parskip}{0pt}",
        r"\thispagestyle{empty}",
        r"{\small\textbf{\ltjsetparameter{kanjiskip={0.10\zw plus 0.04\zw minus 0.02\zw}}Typesetting\_info}\par}",
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
    colophon_texture_enabled: Optional[bool] = None,
) -> Path:
    """
    本文（LaTeX中間）をテンプレートに埋め込み、`.tex` として保存します。

    ``%`` を使用する LaTeX テンプレートは ``%(key)s`` 形式のスタイル書式で埋め込みます
    （``str.format()`` は ``{`` ``}`` の出現が多いLaTeXでは使いづらいため避けています）。
    """
    device_name = device or "iphone"
    font, font_size, chars, spacing, character_spacing = get_pdf_settings(device_name)
    device_layout = get_device_layout_settings(device_name)
    width, height = get_pdf_size(device_name)
    if font_override:
        font = font_override

    use_two_column = str(device_layout.get("mode", "single_column")) == "two_column"
    docclass_extra = ",twocolumn" if use_two_column else ""
    columns = 2 if use_two_column else 1
    pre_info_layout = r"\onecolumn" if use_two_column else ""
    pre_body_layout = r"\twocolumn" if use_two_column else ""
    pre_okuduke_layout = r"\onecolumn" if use_two_column else ""

    margin_top = float(device_layout["margin_top_mm"])
    margin_bottom = float(device_layout["margin_bottom_mm"])
    margin_left = float(device_layout["margin_left_mm"])
    margin_right = float(device_layout["margin_right_mm"])
    show_page_number = bool(device_layout["show_page_number"])

    # ---- JIS X 4051 準拠 レイアウト自動調整 ----
    # ルビサイズ: 本文フォントサイズの 1/2 (JIS X 4051 §6.2)
    # 字間: 漢字間 0pt（ベタ組）、和欧間 0.25zw
    # 行送り: JIS基準 = 字高さ × 1.7 (ルビなし行)。相対単位で指定するとフォントサイズ変更時に自動追従。
    # ルビ間隔: 0.1zh (ルビとルビ親文字の間)。ルビあり行・なし行で行間を均一に保つ。
    ruby_pt = font_size / 2.0
    kanjiskip_expr = f"{character_spacing:.3f}\\zw plus 0.1pt minus 0.1pt"

    layout_tweak_lines = [
        # JIS 準拠字間（漢字間=0、和欧文間=0.25zw）
        "\\ltjsetparameter{kanjiskip={"
        + kanjiskip_expr
        + "},xkanjiskip={0.25\\zw plus 0.1\\zw minus 0.1\\zw}}",
        # JIS準拠行送り（字高さの1.7倍）。相対単位で指定 → font_size 変更時に自動追従。
        # ルビあり行・なし行で行間が不均一になる問題を解消する。
        r"\setlength{\baselineskip}{1.7\zh}",
        # ルビフォントサイズを本文の1/2に設定
        # \providecommand で先に定義してから \renewcommand で上書き（パッケージ未定義エラー回避）
        r"\providecommand{\rubyfontsize}[1]{}",
        rf"\renewcommand{{\rubyfontsize}}[1]{{\fontsize{{{ruby_pt:.1f}pt}}{{{ruby_pt:.1f}pt}}\selectfont}}",
        # 青空HTMLは本文側に全角空白字下げを持つため、TeX既定の段落字下げは無効化する。
        # これで「2字下げ/字下げなし」が混在する現象を防ぐ。
        r"\setlength{\parskip}{0pt}",
        r"\setlength{\parindent}{0pt}",
    ]

    if not show_page_number:
        layout_tweak_lines += [
            r"\setlength{\topskip}{0pt}",
        ]

    layout_tweak = "\n".join(layout_tweak_lines)

    # ---- ページスタイル設定 ----
    # スマホ: ページ番号なし（empty スタイル）
    # PC/iPad: ページ番号あり（aozora スタイル）
    if not show_page_number:
        page_style_block = (
            r"\NewPageStyle{aozora}{nombre_position=bottom-center,nombre={}}" + "\n"
            r"\ModifyPageStyle{plain}{nombre_position=bottom-center,nombre={}}"
        )
        pagestyle_name = "empty"
    else:
        # ページ番号あり
        page_style_block = (
            r"\NewPageStyle{aozora}{" + "\n"
            r"    nombre_position=bottom-center," + "\n"
            r"    nombre={\small \textemdash\ \thepage{} / \pageref{LastBodyPage}\ \textemdash},"
            + "\n"
            r"}" + "\n"
            r"\ModifyPageStyle{plain}{" + "\n"
            r"    nombre_position=bottom-center," + "\n"
            r"    nombre={\small \textemdash\ \thepage{} / \pageref{LastBodyPage}\ \textemdash},"
            + "\n"
            r"}"
        )
        pagestyle_name = "aozora"

    # HTML カラーコードから ``#`` を除いて渡す
    bg_color = background_color.lstrip("#")
    fg_color = text_color.lstrip("#")
    okuduke = (
        okuduke_override if okuduke_override is not None else load_okuduke_template()
    )

    global_settings = settings_store.get_global_settings()
    legacy_washi = bool(global_settings.get("washi_theme_enabled", False))

    resolved_main_washi_enabled = (
        bool(main_washi_enabled)
        if main_washi_enabled is not None
        else bool(global_settings.get("main_washi_enabled", legacy_washi))
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
    resolved_colophon_texture_enabled = (
        bool(colophon_texture_enabled)
        if colophon_texture_enabled is not None
        else bool(global_settings.get("colophon_texture_enabled", False))
    )

    # iPhone / Android は本文外周の枠を常に無効化する。
    frame_allowed_devices = {"pc", "ipad", "ipad_landscape"}
    if device_name not in frame_allowed_devices:
        resolved_main_frame_enabled = False

    # ---- テンプレートブロックの生成 ----
    # 各テンプレートファイルを読み込み、プレースホルダをレンダリング
    frontcover_template = load_frontcover_template()
    typesetting_info_template = load_typesetting_info_template()
    main_text_template = load_main_text_template()
    colophon_template = load_colophon_template()
    washi_texture_template = load_washi_texture_template()
    cover_texture = load_cover_texture_template(resolved_cover_texture_variant)
    main_frame_texture = load_main_frame_template(resolved_main_frame_variant)

    cover_washi_texture = render_washi_texture_by_section(
        template_text=washi_texture_template,
        device=device_name,
        section="cover",
        page_width_mm=width,
        page_height_mm=height,
    )
    main_washi_texture = render_washi_texture_by_section(
        template_text=washi_texture_template,
        device=device_name,
        section="main",
        page_width_mm=width,
        page_height_mm=height,
    )
    colophon_washi_texture = render_washi_texture_by_section(
        template_text=washi_texture_template,
        device=device_name,
        section="colophon",
        page_width_mm=width,
        page_height_mm=height,
    )

    # 組版情報ページを生成
    if html_path is not None:
        typesetting_info_body = build_info_page(
            html_path=html_path,
            font=font,
            font_size=font_size,
            chars=chars,
            spacing=spacing,
            width=width,
            height=height,
            character_spacing=character_spacing,
            device=device_name,
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
    cover_blocks: list[str] = []
    if resolved_cover_texture_enabled and cover_texture:
        cover_blocks.append(_make_one_page_overlay_block(cover_texture))
    if resolved_cover_texture_enabled and cover_washi_texture:
        cover_blocks.append(_make_one_page_overlay_block(cover_washi_texture))
    cover_texture_block = "".join(cover_blocks)

    colophon_texture_block = (
        _make_one_page_overlay_block(colophon_washi_texture)
        if resolved_colophon_texture_enabled and colophon_washi_texture
        else ""
    )

    overlays: list[str] = []
    if resolved_main_washi_enabled and main_washi_texture:
        overlays.append(_make_multi_page_overlay_start(main_washi_texture))
    if resolved_main_frame_enabled and main_frame_texture:
        overlays.append(_make_multi_page_overlay_start(main_frame_texture))
    main_overlay_start = "".join(overlays)
    main_overlay_end = _make_multi_page_overlay_end(has_overlay=len(overlays) > 0)

    frontcover_block = render_template_block(
        frontcover_template,
        {
            "title": title,
            "author": author,
            "cover_texture_block": cover_texture_block,
        },
    )
    typesetting_info_block = render_template_block(
        typesetting_info_template, {"typesetting_info_body": typesetting_info_body}
    )
    main_text_block = render_template_block(
        main_text_template,
        {
            "pre_main_text_layout": pre_body_layout,
            "main_text_body": latex_body,
            "pagestyle_name": pagestyle_name,
            "main_overlay_start": main_overlay_start,
            "main_overlay_end": main_overlay_end,
        },
    )
    colophon_block = render_template_block(
        colophon_template,
        {
            "colophon_body": okuduke,
            "colophon_texture_block": colophon_texture_block,
        },
    )

    content = LATEX_TEMPLATE_JLREQ_TATE % {
        "font": font,
        "font_size": font_size,
        "docclass_extra": docclass_extra,
        "bg_color": bg_color,
        "fg_color": fg_color,
        "title": title,
        "author": author,
        "body": latex_body,
        "width": width,
        "height": height,
        "chars": chars,
        "spacing": spacing,
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
    """
    CLI エントリポイント。

    流れ:
    1. 引数を読む
    2. 入力がディレクトリなら ``*.html``/``*.xhtml`` を列挙、ファイルならそれだけ処理
    3. 1ファイルずつ html → latex_body → tex を生成
    4. 失敗はログに例外スタックトレースを残し、他のファイルは続行
    """
    parser = argparse.ArgumentParser(
        description="Aozora HTML/XHTML -> LuaLaTeX .tex generator (local files only)"
    )
    parser.add_argument("source", help="local HTML file path OR directory (data/)")
    parser.add_argument(
        "--out", help="output directory (default: ./out)", default="out"
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
        choices=[
            "iphone",
            "android",
            "ipad",
            "ipad_landscape",
            "pc",
        ],
        help="PDF output device: iphone | android | ipad | ipad_landscape | pc",
        default="iphone",
    )
    parser.add_argument(
        "--mode",
        choices=["light", "dark", "intermediate"],
        help="PDF color mode: light, dark, or intermediate (overrides config)",
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
        help="save current mode/color/font settings into custom config files",
    )
    parser.add_argument(
        "--reset-settings",
        action="store_true",
        help="reset custom config files back to default values before generation",
    )
    parser.add_argument(
        "--main-washi",
        dest="main_washi_enabled",
        action="store_true",
        help="enable washi background on main text pages",
    )
    parser.add_argument(
        "--no-main-washi",
        dest="main_washi_enabled",
        action="store_false",
        help="disable washi background on main text pages",
    )
    parser.add_argument(
        "--main-frame",
        dest="main_frame_enabled",
        action="store_true",
        help="enable decorative frame on main text pages (pc/ipad only)",
    )
    parser.add_argument(
        "--no-main-frame",
        dest="main_frame_enabled",
        action="store_false",
        help="disable decorative frame on main text pages",
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
        "--colophon-texture",
        dest="colophon_texture_enabled",
        action="store_true",
        help="enable texture on colophon page",
    )
    parser.add_argument(
        "--no-colophon-texture",
        dest="colophon_texture_enabled",
        action="store_false",
        help="disable texture on colophon page",
    )
    parser.set_defaults(
        main_washi_enabled=None,
        main_frame_enabled=None,
        cover_texture_enabled=None,
        colophon_texture_enabled=None,
    )
    args = parser.parse_args()

    if args.reset_settings:
        settings_store.reset_custom_settings()

    mode = resolve_color_mode(args.device, args.mode)

    # デバイス設定の表示
    width, height = get_pdf_size(args.device)
    print(f"Generating PDF for {args.device} with size {width}x{height} mm")

    background_color, text_color = get_color_settings(mode)
    if args.bg_color:
        background_color = args.bg_color
    if args.fg_color:
        text_color = args.fg_color

    if args.save_settings:
        save_current_settings(
            device=args.device,
            mode=mode,
            background_color=background_color,
            text_color=text_color,
            font_override=args.font,
        )

        decoration_updates: dict[str, Any] = {}
        if args.main_washi_enabled is not None:
            value = "true" if bool(args.main_washi_enabled) else "false"
            decoration_updates["main_washi_enabled"] = value
            decoration_updates["washi_theme_enabled"] = value
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
        if args.colophon_texture_enabled is not None:
            decoration_updates["colophon_texture_enabled"] = (
                "true" if bool(args.colophon_texture_enabled) else "false"
            )
        if decoration_updates:
            settings_store.save_settings({"global": decoration_updates})

    src_path = Path(args.source)
    outdir = (WORKDIR / args.out).resolve()
    outdir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = outdir / f"aozoratex_{timestamp}.log"
    logger = setup_logger(log_path, verbose=args.verbose)

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
            html, enc_used = fetch_html_local(
                str(in_path), preferred_encoding=args.encoding
            )
            logger.info("read: %s (encoding=%s)", in_path, enc_used)

            body = html_to_latex_body(html, parser=args.parser)
            title, author = extract_title_author(html, parser=args.parser)
            okuduke = build_okuduke_from_html(html, parser=args.parser)

            out_tex = outdir / (in_path.stem + ".tex")
            build_tex_file(
                latex_body=body,
                out_tex=out_tex,
                device=args.device,
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
                colophon_texture_enabled=args.colophon_texture_enabled,
            )
            logger.info("write: %s", out_tex)
            success_count += 1  # type: ignore
        except Exception as e:
            logger.exception("failed: %s (%s)", in_path, e)

    logger.info("done: %d/%d", success_count, len(inputs))
    if success_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
