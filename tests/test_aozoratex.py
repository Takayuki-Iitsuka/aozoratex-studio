import unittest
from pathlib import Path
import shutil

from bs4 import BeautifulSoup

from src import aozoratex


class _DummyJigmoDB:
    def select(self, codepoint: int):
        return None


class AozoraTexHeadingBookmarkTests(unittest.TestCase):
    def setUp(self) -> None:
        self.original_jigmo_db_getter = aozoratex._get_jigmo_db
        aozoratex._get_jigmo_db = lambda: _DummyJigmoDB()

    def tearDown(self) -> None:
        aozoratex._get_jigmo_db = self.original_jigmo_db_getter

    def test_ruby_heading_bookmark_uses_base_text(self) -> None:
        soup = BeautifulSoup(
            "<h2><ruby><rb>漢字</rb><rt>かんじ</rt></ruby>見出し</h2>",
            "html.parser",
        )

        latex = aozoratex.convert_node(soup.h2)

        self.assertEqual(
            latex,
            r"\AozoraPart{\ltjruby{漢字}{かんじ}見出し}{漢字見出し}" + "\n\n",
        )

    def test_gaiji_heading_bookmark_uses_unknown_label(self) -> None:
        soup = BeautifulSoup(
            '<h3>第<img class="gaiji" src="../../../gaiji/unknown.png" alt="欠字注記"/>章</h3>',
            "html.parser",
        )

        bookmark_text = aozoratex._normalize_bookmark_text(
            "".join(
                aozoratex.convert_node_to_bookmark_text(child)
                for child in soup.h3.contents
            )
        )

        self.assertEqual(bookmark_text, "第欠字注記章")

    def test_gaiji_heading_bookmark_uses_unicode_when_resolved(self) -> None:
        soup = BeautifulSoup(
            '<h4>第<img class="gaiji" src="gaiji/sample.png" alt="U+4E00"/>章</h4>',
            "html.parser",
        )

        latex = aozoratex.convert_node(soup.h4)

        self.assertIn(r"}{第一章}", latex)


class AozoraTexWhitespacePreservationTests(unittest.TestCase):
    WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
    OUTPUT_ROOT = WORKSPACE_ROOT / "out" / "work"

    def setUp(self) -> None:
        self.original_jigmo_db_getter = aozoratex._get_jigmo_db
        aozoratex._get_jigmo_db = lambda: _DummyJigmoDB()

    def tearDown(self) -> None:
        aozoratex._get_jigmo_db = self.original_jigmo_db_getter

    def test_html_to_latex_body_keeps_trailing_spaces_before_newline(self) -> None:
        html = '<html><body><div id="main_text"><p>行末スペース  </p></div></body></html>'

        body = aozoratex.html_to_latex_body(html)

        self.assertIn("行末スペース  \n\n", body)

    def test_html_to_latex_body_does_not_insert_block_newline(self) -> None:
        html = '<html><body><div id="main_text"><div>甲</div><div>乙</div></div></body></html>'

        body = aozoratex.html_to_latex_body(html)

        self.assertEqual(body, "甲乙")

    def test_convert_node_jisage_class_no_longer_adds_indent_command(self) -> None:
        soup = BeautifulSoup('<div class="jisage_8">  本文</div>', "html.parser")

        latex = aozoratex.convert_node(soup.div)

        self.assertEqual(latex, "  本文")
        self.assertNotIn(r"\AozoraJisage", latex)

    def test_generated_tex_heading_macros_are_not_centered_or_indented(self) -> None:
        out_dir = self.OUTPUT_ROOT / "test_aozoratex_macros"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_tex = out_dir / "no_centering.tex"
        try:
            aozoratex.build_tex_file(
                latex_body="本文\n",
                out_tex=out_tex,
                use_default_settings=True,
            )
            content = out_tex.read_text(encoding="utf-8")
        finally:
            if out_dir.exists():
                shutil.rmtree(out_dir, ignore_errors=True)

        self.assertIn(r"\newcommand{\AozoraTitle}[1]{\par\addvspace{\zh}#1\par\addvspace{\zh}}", content)
        self.assertIn(r"\addvspace{\zh}", content)  # 見出し前後に空行スペース
        self.assertIn(r"\newcommand{\AozoraJisage}[2]{#2}", content)
        self.assertNotIn(r"\begin{center}\Large\textbf{#1}\end{center}", content)
        self.assertNotIn(r"\hspace*{#1\zw}", content)
        self.assertNotIn(r"\par\bigskip\noindent\textbf{\Large #1}\par\smallskip", content)


if __name__ == "__main__":
    unittest.main()
