# HTML → LaTeX 変換ルール

## 1. 見出し（Heading）

| HTML | LaTeX | 備考 |
|------|-------|------|
| `<h1 class="title">三国志</h1>` | `\AozoraTitle{三国志}` | 書籍タイトル |
| `<h2 class="subtitle">二巻の巻</h2>` | `\AozoraPart{...}{...}` | サブタイトル |
| `<h2 class="author">吉川英治</h2>` | `\AozoraPart{...}{...}` | 著者名（h2扱い） |
| `<h3 class="o-midashi">...</h3>` | `\AozoraChapter{表示}{しおり用テキスト}` | 大見出し、PDFしおり level=1 |
| `<h4 class="naka-midashi">...</h4>` | `\AozoraSection{表示}{しおり用テキスト}` | 中見出し、PDFしおり level=2 |

---

## 2. 字下げ付き見出し（Jisage + Heading）★今回修正

| HTML | LaTeX |
|------|-------|
| `<div class="jisage_3"><h3 class="o-midashi"><a>偽忠狼心…</a></h3></div>` | `\AozoraChapter{\hspace{3\zw}\ltjruby{偽忠狼心}{ぎちゅうろうしん}}{偽忠狼心}` |
| `<div class="jisage_7"><h4 class="naka-midashi"><a>一</a></h4></div>` | `\AozoraSection{\hspace{7\zw}一}{一}` |
| `<div class="jisage_N">本文テキスト</div>` | 本文テキスト（見出し以外の jisage は素通し） |

> **注意：** しおりテキスト（第2引数）には `\hspace` は含まれず、純テキストのみ。

---

## 3. ルビ

| HTML | LaTeX |
|------|-------|
| `<ruby><rb>曹操</rb><rp>(</rp><rt>そうそう</rt><rp>)</rp></ruby>` | `\ltjruby{曹操}{そうそう}` |
| `<rp>（</rp>` | （除去） |
| `<rt>ふりがな</rt>` | `\ltjruby` 第2引数へ |

---

## 4. 外字

| HTML | LaTeX | 種別 |
|------|-------|------|
| `<img class="gaiji" src="gaiji/1-92/1-92-19.png" alt="譙（U+8B59相当）">` | `\AozoraGaijiGlyph{jigmo2}{8B59}{譙}` | Jigmoフォントで解決済み |
| `<img class="gaiji" src="..." alt="〻">` | `\AozoraGaijiAuto{303B}{〻}` | ランタイムでJigmo検索、フォールバック 〻 あり |
| 未解決外字 | `\AozoraGaijiUnknown{[GAIJI:src]}{tooltip}` | 本ファイルでは 0件 |

**本ファイルで出現する Jigmo 解決済み外字一覧：**
譙(8B59)、滎(6ECE)、伷(4F37)、兗(5157)、邈(9088)、瓚(74DA)、〻(303B)

---

## 5. 改行・段落

| HTML | LaTeX |
|------|-------|
| `<br />` | `\n\par\n` |
| `<p>...</p>` | `内容\n\n` |
| 行頭全角スペース `　` | そのまま保持（`\@` 前置きなし） |

---

## 6. 装飾・強調

| HTML | LaTeX |
|------|-------|
| `<em class="sesame_dot">...</em>` | `\bouten{...}` |
| `<span class="bou">...</span>` | `\bouten{...}` |
| `<b>...</b>` / `<strong>...</strong>` | `\textbf{...}` |

---

## 7. 構造ブロック

| HTML | LaTeX | 処理 |
|------|-------|------|
| `<div class="metadata">...</div>` | （スキップ） | 別途 frontmatter に使用 |
| `<div id="contents">...</div>` | （スキップ） | TOCブロック除去 |
| `<div class="main_text">...</div>` | 本文として展開 | 中の子ノードを変換 |
| `<div>` / `<span>` 一般 | 中身を素通し | タグ自体は消滅 |

---

## 8. PDFしおり構造
```
pdfbookmark[0]  ← \AozoraPart    (h2)
pdfbookmark[1]  ← \AozoraChapter (h3, o-midashi)
pdfbookmark[2]  ← \AozoraSection (h4–h6, naka-midashi)
```

各しおりは `\phantomsection` + `\refstepcounter` でカウンター管理され、アンカーIDは `aozora-chapter-{part}-{chapter}` 形式。