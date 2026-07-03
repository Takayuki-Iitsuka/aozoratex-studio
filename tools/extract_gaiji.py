#!/usr/bin/env python3
"""
青空文庫の HTML ファイルから外字（<img class="gaiji">）の alt 属性を抽出し、
出現頻度を集計してレポート（CSV）を出力するスクリプト。
"""

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path
from bs4 import BeautifulSoup

# src のモジュールを読み込めるように sys.path を調整
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.aozoratex import fetch_html_local, GAIJI_ALT_TO_UNICODE


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract and tally Gaiji from Aozora HTML files."
    )
    parser.add_argument(
        "source",
        nargs="?",
        default="data",
        help="Target HTML file or directory (default: data)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="gaiji_report.csv",
        help="Output CSV file path (default: gaiji_report.csv)",
    )
    args = parser.parse_args()

    source_path = Path(args.source)
    if not source_path.exists():
        print(f"Error: {source_path} does not exist.", file=sys.stderr)
        sys.exit(1)

    html_files: list[Path] = []
    if source_path.is_dir():
        html_files.extend(source_path.glob("**/*.html"))
        html_files.extend(source_path.glob("**/*.xhtml"))
    else:
        html_files.append(source_path)

    if not html_files:
        print(f"No HTML/XHTML files found in {source_path}.", file=sys.stderr)
        sys.exit(0)

    gaiji_counter: Counter[str] = Counter()
    total_files = len(html_files)

    print(f"Processing {total_files} files for gaiji extraction...")

    for i, file_path in enumerate(html_files, 1):
        try:
            html_text, _ = fetch_html_local(str(file_path))
            soup = BeautifulSoup(html_text, "html.parser")
            for img in soup.find_all("img", class_="gaiji"):
                alt = img.get("alt", "").strip()
                if alt:
                    gaiji_counter[alt] += 1
        except Exception as e:
            print(
                f"[{i}/{total_files}] Failed to process {file_path}: {e}",
                file=sys.stderr,
            )

    if not gaiji_counter:
        print("No gaiji found in the specified files.")
        sys.exit(0)

    # ソート: 出現回数（降順） > altの文字列（昇順）
    sorted_gaiji = sorted(gaiji_counter.items(), key=lambda x: (-x[1], x[0]))

    output_path = Path(args.output)
    try:
        # Excel で開いたときに文字化けしないよう utf-8-sig で保存
        with output_path.open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "注記テキスト (Alt Text)",
                    "出現回数",
                    "対応済Unicode",
                    "要辞書追加 (Needs Addition)",
                ]
            )

            for alt, count in sorted_gaiji:
                known_unicode = ""
                for key, uni_char in GAIJI_ALT_TO_UNICODE.items():
                    if key in alt:
                        known_unicode = uni_char
                        break
                needs_addition = "" if known_unicode else "★追加を推奨"

                writer.writerow([alt, count, known_unicode, needs_addition])

        print(f"\nExtraction complete! Found {len(gaiji_counter)} unique gaiji.")
        print(f"Report saved to: {output_path.resolve()}")
    except Exception as e:
        print(f"Failed to write report: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
