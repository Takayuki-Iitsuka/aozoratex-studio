# 組版計算：JIS規格（JLREQ）に基づくフォントサイズ連動設定

このドキュメントでは、フォントサイズ（Base font size）を変更した際に、JIS X 4051（日本語文書の組版方法）および W3C の「日本語組版処理の要件（JLREQ）」に基づいてルビ・行間・行送り・字間を自動計算するための、計算式とPythonスクリプト実装例をまとめます。

---

## 1. 根拠となる規格

| 規格 | 正式名称 |
|---|---|
| **JIS X 4051:2004** | Formatting rules for Japanese documents（日本語文書の組版方法） |
| **JLREQ** | W3C Working Group Note: Requirements for Japanese Text Layout |

---

## 2. 組版要素の計算式

Base font size（基準フォントサイズ）を $S$ とします。

| 項目 | English（専門用語） | 計算式 | 備考 |
|---|---|---|---|
| ルビサイズ | Ruby size | $R = \dfrac{1}{2} S$ | 親文字に対して1/2（二分）の大きさが原則（JIS X 4051 §6.2）。 |
| ルビ間隔 | Ruby gap | $R_{gap} = 0.1 \times S$ | 親文字とルビの間の最小空き。 |
| ルビ占有高 | Ruby ascent | $R_{total} = R + R_{gap}$ | ルビが天方向に飛び出す高さ。天マージン設計に使用。 |
| 行間 | Line gap / Leading | $L = 0.5 S \sim 1.0 S$ | 画面が狭い場合は $0.5 S$（半角アキ）、ゆったり読ませる場合は $1.0 S$（全角アキ）を推奨。 |
| 行送り（ルビなし） | Line height (no ruby) | $F = S \times 1.7$ | ベースラインからベースラインまでの距離。 |
| 行送り（ルビあり） | Line height (with ruby) | $F_{ruby} = S \times 1.7 + R_{total}$ | ルビの飛び出し分を加算。 |
| 字間（和字） | Letter spacing | $C = 0$ | Solid typesetting（ベタ組み）が原則。 |
| 字間（和欧文混植） | Xkanji skip | $C_{xk} = 0.25 \times S$ | 和字と欧文字の境界に四分アキを挿入（`xkanjiskip`）。 |

> [!NOTE]
> 天マージンは `通常マージン + pt_to_mm(Rtotal)` 以上を確保することで、ルビの天飛び出しによるクリッピングを防止できます。

---

## 3. TeXの相対単位について

TeXには、現在のフォントサイズを基準とした Relative units（相対単位）が存在します。

| 単位 | 意味 |
|---|---|
| `zw` または `em` | 全角幅（フォントサイズ $S$ と同等） |
| `zh` | 全角高さ（和文フォントサイズ $S$ と同等） |

### 推奨アプローチ：絶対値計算 vs 相対単位出力

スクリプトでTeXを自動生成する場合、**スクリプト内で絶対値を計算せず、TeXの相対単位を出力させる**アプローチを推奨します。

```latex
% 行送りをフォントの1.5倍にする例
\setlength{\baselineskip}{1.5zh}
```

| 方式 | メリット | デメリット | リスク |
|---|---|---|---|
| **相対単位出力**（推奨） | TeXエンジンが自動スケール。後からフォントサイズを変更してもルビ・行間が追従。 | TeXソースを見ただけでは最終的な絶対値が分かりにくい。 | `zw`/`zh` の解釈がパッケージ更新で微妙に変わる可能性がある。 |
| **絶対値計算** | LuaLaTeXに渡す時点でサイズが固定され、解釈違いによるレイアウト崩れを防げる。デバイス解像度に応じた動的変更が容易。 | TeXソース上に `\fontsize{10pt}{15pt}` のようなハードコード値が散乱し、微調整が困難。 | Floating point arithmetic（浮動小数点演算）の丸め誤差（例: 行送りが `14.9999pt`）が発生しコンパイル警告の原因になる可能性がある。 |

---

## 4. Pythonスクリプト実装例

任意の `base_font_size`（基準フォントサイズ）を引数として受け取り、各組版要素の計算値を `dict` 形式で返す関数の実装例です。

```python
def calculate_typography_settings(base_font_size: float) -> dict:
    """
    基準フォントサイズから組版に必要な各要素のサイズを計算します。
    根拠: JIS X 4051:2004 および W3C JLREQ

    Parameters:
        base_font_size (float): Base font size（基準フォントサイズ）(単位は任意, 例: pt)

    Returns:
        dict: 計算された各要素のサイズを含む辞書
    """
    # --- 定数（調整可能） ---
    LINE_SPACE_BASE   = 1.7   # 行間の基本倍率（1.5〜1.8）
    RUBY_SIZE_RATIO   = 0.5   # ルビサイズ比率（JIS X 4051 §6.2）
    RUBY_SEP_RATIO    = 0.1   # ルビ間隔比率
    XKANJI_SKIP_RATIO = 0.25  # 和欧文字間（四分アキ）

    # Ruby size（ルビサイズ）: 親文字の半分
    ruby_size = base_font_size * RUBY_SIZE_RATIO

    # Ruby gap（ルビ間隔）
    ruby_gap = base_font_size * RUBY_SEP_RATIO

    # Ruby ascent（ルビ占有高）: 天マージン計算用
    ruby_ascent = ruby_size + ruby_gap

    # Line gap（行間）: 半角アキ(0.5) と 全角アキ(1.0)
    line_gap_narrow = base_font_size * 0.5
    line_gap_wide   = base_font_size * 1.0

    # Line height（行送り）: ルビなし・ルビあり
    line_height_base      = base_font_size * LINE_SPACE_BASE
    line_height_with_ruby = line_height_base + ruby_ascent

    # Letter spacing（字間）: ベタ組み
    letter_spacing  = 0.0
    xkanji_skip     = base_font_size * XKANJI_SKIP_RATIO

    return {
        "base_font_size":        base_font_size,
        "ruby_size":             ruby_size,
        "ruby_gap":              ruby_gap,
        "ruby_ascent":           ruby_ascent,
        "line_gap_narrow":       line_gap_narrow,
        "line_gap_wide":         line_gap_wide,
        "line_height_base":      line_height_base,
        "line_height_with_ruby": line_height_with_ruby,
        "letter_spacing":        letter_spacing,
        "xkanji_skip":           xkanji_skip,
    }


# --- 使用例 ---
if __name__ == "__main__":
    target_size = 10.0  # 基準フォントサイズ (pt)
    s = calculate_typography_settings(target_size)

    print(f"--- Typography Settings (Base = {target_size}pt) ---")
    print(f"Ruby size（ルビサイズ）           : {s['ruby_size']}pt")
    print(f"Ruby gap（ルビ間隔）              : {s['ruby_gap']}pt")
    print(f"Ruby ascent（ルビ占有高）         : {s['ruby_ascent']}pt")
    print(f"Line height, base（行送り/ルビなし）: {s['line_height_base']}pt")
    print(f"Line height + ruby（行送り/ルビあり）: {s['line_height_with_ruby']}pt")
    print(f"Line gap narrow（行間/半角アキ）  : {s['line_gap_narrow']}pt")
    print(f"Line gap wide（行間/全角アキ）    : {s['line_gap_wide']}pt")
    print(f"Letter spacing（字間）            : {s['letter_spacing']}pt")
    print(f"Xkanji skip（和欧文字間）         : {s['xkanji_skip']}pt")
```

### コマンドライン使用例

```bash
# 基本（A5縦書き・10pt・ルビあり）
python jlreq_calc.py 10 --paper a5 --tate

# ルビなし横書き
python jlreq_calc.py 12 --paper a4 --no-ruby

# .texファイルに保存
python jlreq_calc.py 9 --paper b6 --tate --output mybook.tex
```

---

## 5. 潜在的なリスクと留意点

### リスク1：フォント固有のメトリクス（Font Metrics）

$R = 0.5 S$ による計算はあくまで**理論値**です。使用する和文フォント（游明朝、Noto Sans JP など）の Font metrics（フォントメトリクス：実際の字面の大きさやベースラインの位置）によっては、理論値通りにルビを配置すると親文字と衝突したり、行間が詰まって見えたりするリスクがあります。

### リスク2：スマートフォン描画時の端数処理

スクリプトで計算した数値をTeXに渡しても、最終的にスマートフォン用の PDF Viewer（PDFビューア）で表示される際、画面の Pixel density（画素密度）によって Rendering（レンダリング）時に端数処理（丸め誤差）が発生します。特にルビのような極小の文字は潰れたりかすれたりするリスクがあります。

### リスク3：タイポグラフィの観点からの限界

機械的な計算式は**プログラム処理としては最適**ですが、Typography（タイポグラフィ）の観点からは不十分な場合があります。フォントの Visual weight（視覚的なウェイト・黒み）や、ひらがな・漢字の比率によって、数学的に正しい行間が視覚的に美しいとは限りません。

---

## 6. テキスト生成への連携（TeXコードの自動生成）

Pythonのf-stringを使用してLuaLaTeXコマンドへ直接流し込む例：

```python
def generate_tex_settings(base_font_size: float) -> str:
    s = calculate_typography_settings(base_font_size)
    return f"""
% --- 自動生成された組版設定 (base={base_font_size}pt) ---
\\fontsize{{{base_font_size}pt}}{{{s['line_height_with_ruby']:.4f}pt}}\\selectfont
\\setlength{{\\xkanjiskip}}{{{s['xkanji_skip']:.4f}pt}}
"""
```

---

*※ この文書は、「Pythonによる組版設定の計算.md」「ルビ.md」「日本語文書の組版方法.md」「フォントのサイズ自動化.md」（組版計算部分）を統合・整理したものです。*
