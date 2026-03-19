# LuaLaTeX 推奨フォントカタログ
## 書体別ランキング・設定コマンド・フォント特性 完全早見表

> **Engine** : LuaLaTeX / LuaHBTeX (TeX Live 2026) / **OS** : Windows  
> **出典** : `texlive_fonts.csv` + 厳選推奨フォント.md

**収録書体** : 和文（明朝体 / ゴシック体 / 丸ゴシック / 楷書体 / 行書体）／ 欧文（セリフ体 / サンセリフ体 / 等幅体）

---

## 凡例・使い方

### ランク

| 記号 | 意味 |
|------|------|
| ★★★ | 最高推奨（外字・IVS・ウェイト充実） |
| ★★☆ | 強く推奨（実用十分） |
| ★☆☆ | 推奨（用途限定） |

### 入手先

| 記号 | 意味 |
|------|------|
| `TL` | TeX Live 2026 同梱（追加インストール不要） |
| `Win` | Windows 標準搭載 |
| `別途` | 別途インストール必要 |

### コピペ方法

「コピペ用コマンド」列のテキストをプリアンブルに貼り付けるだけで使用可能。  
和文フォントには `\setmainjfont`、欧文には `\setmainfont` を使用。

> **TTC について** : TTC（TrueType Collection）は複数フォントを含むコンテナ。  
> LuaLaTeX では `[FontIndex=0]` 等でスタイルを選択可能。

---

## §A　和文明朝体 推奨ランキング TOP 10

**コマンド** : `\setmainjfont{フォント名}`

> 明朝体は書籍・公文書・縦組み文書に適したセリフ系和文フォント。  
> IVS（異体字セレクタ）対応・Adobe-Japan1 グリフ充実度がポイント。  
> 太字（Bold）フォントが別ファイルで用意されているものが組版品質に優れる。

| # | フォント名（英語） | 和名 | 推奨 | 入手 | コピペ用コマンド | 形式 | 特徴・推奨用途 |
|:-:|---|---|:---:|:---:|---|:---:|---|
| 1 | Harano Aji Mincho | 原ノ味明朝 | ★★★ | `TL` | `\setmainjfont{Harano Aji Mincho}` | OTF | TeX Live 同梱・Adobe-Japan1-7（AJ1-7）準拠・IVS 対応・7 ウェイト。LuaLaTeX の事実上の標準。 |
| 2 | Source Han Serif JP | 源ノ明朝 JP | ★★★ | `別途` | `\setmainjfont{Source Han Serif JP}` | OTF | Adobe×Google 製・7 ウェイト・変体仮名収録・Unicode 全域対応。最高品質だが別途インストール必要。 |
| 3 | Yu Mincho | 游明朝 | ★★★ | `Win` | `\setmainjfont{Yu Mincho}` | TTF | Windows 標準搭載・書籍品質・JIS 第四水準収録・縦組み対応。ゴシック体と字形が統一されている。 |
| 4 | IPAmjMincho | IPAmj 明朝 | ★★★ | `別途` | `\setmainjfont{IPAmjMincho}` | TTF | 外字・異体字対応が最強クラス。MJ 文字図鑑対応・約 58,000 字収録。公文書・行政システム向け。 |
| 5 | Noto Serif JP | Noto 明朝 JP | ★★☆ | `別途` | `\setmainjfont{Noto Serif JP}` | TTF | Google 製・Unicode 全域・7 ウェイト（Variable Font）対応。CJK 対応で多言語混植に有利。 |
| 6 | BIZ UDMincho | BIZ UD 明朝 | ★★☆ | `Win` | `\setmainjfont{BIZ UDMincho}` | TTF | UD（ユニバーサルデザイン）設計・高視認性・Windows 標準搭載。公文書・プレゼン資料向け。 |
| 7 | Shippori Mincho | しっぽり明朝 | ★★☆ | `別途` | `\setmainjfont{Shippori Mincho}` | TTF | 書籍・文学向けの美しい字形・5 ウェイト対応。縦組み・横組みどちらも高品質。 |
| 8 | IPAexMincho | IPAex 明朝 | ★★☆ | `TL` | `\setmainjfont{IPAexMincho}` | TTF | TeX Live 同梱・動作実績豊富・IPA ライセンス（商用利用可）。安定性・互換性が高い定番フォント。 |
| 9 | Zen Old Mincho | 禅旧明朝 | ★★☆ | `別途` | `\setmainjfont{Zen Old Mincho}` | TTF | 旧字体・古典スタイル収録・5 ウェイト。歴史的文献・古文書の組版に適している。 |
| 10 | GenEi Chikugo Mincho v3 | 源暎ちくご明朝 v3 | ★☆☆ | `別途` | `\setmainjfont{GenEi Chikugo Mincho v3}` | TTF | 縦組み用に設計された和文明朝。俳句・短歌・詩集など縦書き主体の文芸作品に最適。 |

### 明朝体 コマンド例（ウェイト指定付き）

```latex
% 標準指定（Regular のみ）
\setmainjfont{Harano Aji Mincho}

% Bold ファイルを別途指定する場合
\setmainjfont{Harano Aji Mincho}[
  BoldFont     = {Harano Aji Mincho},
  BoldFeatures = {FakeBold=2.5},  % Bold がない場合の合成太字
  Scale        = 1.0              % 欧文フォントとのスケール調整（0.9〜1.05 が目安）
]
```

---

## §B　和文ゴシック体 推奨ランキング TOP 10

**コマンド** : `\setsansjfont{フォント名}`

> ゴシック体は見出し・キャプション・UI テキストに適したサンセリフ系和文フォント。  
> 明朝体と同一フォントファミリーで揃えると字形の統一感が出る。

| # | フォント名（英語） | 和名 | 推奨 | 入手 | コピペ用コマンド | 形式 | 特徴・推奨用途 |
|:-:|---|---|:---:|:---:|---|:---:|---|
| 1 | Harano Aji Gothic | 原ノ味角ゴシック | ★★★ | `TL` | `\setsansjfont{Harano Aji Gothic}` | OTF | TeX Live 同梱・AJ1-7・IVS 対応・7 ウェイト。明朝体と揃えて使えるため最優先推奨。 |
| 2 | Noto Sans JP | Noto Sans JP | ★★★ | `別途` | `\setsansjfont{Noto Sans JP}` | TTF | Google 製・7 ウェイト・Variable Font・CJK 全域対応。Web 標準として普及済みで視認性が高い。 |
| 3 | Yu Gothic | 游ゴシック | ★★★ | `Win` | `\setsansjfont{Yu Gothic}` | TTC | Windows 標準・游明朝と字形が統一・Regular/Bold 収録。游明朝との混植が自然で美しい。 |
| 4 | BIZ UDGothic | BIZ UD ゴシック | ★★☆ | `Win` | `\setsansjfont{BIZ UDGothic}` | TTC | UD 設計・Windows 標準・高視認性。BIZ UD 明朝と組み合わせて公文書・報告書に最適。 |
| 5 | Source Han Code JP | 源ノ角ゴシック Code JP | ★★☆ | `別途` | `\setsansjfont{Source Han Code JP}` | TTC | Adobe×Google 製等幅版・プログラムリスト・技術文書に特化。CJK 全域・7 ウェイト対応。 |
| 6 | Meiryo | メイリオ | ★★☆ | `Win` | `\setsansjfont{Meiryo}` | TTC | Windows Vista 以降の標準 UI フォント・高可読性。スクリーン表示を想定した設計で印刷向きではない。 |
| 7 | IPAexGothic | IPAex ゴシック | ★★☆ | `TL` | `\setsansjfont{IPAexGothic}` | TTF | TeX Live 同梱・IPA ライセンス・動作実績豊富。IPAex 明朝とのセット使用が定番。 |
| 8 | Gen Jyuu Gothic | 源柔ゴシック | ★★☆ | `別途` | `\setsansjfont{Gen Jyuu Gothic}` | TTF | 柔らかく丸みのある字形・7 ウェイト。エディトリアル・カジュアルな文書に適している。 |
| 9 | Zen Kaku Gothic New | 禅角ゴシック New | ★★☆ | `別途` | `\setsansjfont{Zen Kaku Gothic New}` | TTF | 現代的なクリーンな字形・5 ウェイト。技術系文書・プレゼンテーションに向く。 |
| 10 | HGGothicM | HG ゴシック M | ★☆☆ | `Win` | `\setsansjfont{HGGothicM}` | TTC | リコー製・Windows/Office 同梱・安定動作。ビジネス文書での実績は豊富だが字形はやや古め。 |

### ゴシック体 推奨ペアコマンド例

```latex
% 最推奨ペア①：原ノ味（TeX Live 同梱のみで完結）
\setmainjfont{Harano Aji Mincho}    \setsansjfont{Harano Aji Gothic}

% 最推奨ペア②：游フォント（Windows 環境）
\setmainjfont{Yu Mincho}            \setsansjfont{Yu Gothic}

% 最推奨ペア③：BIZ UD（公文書・高視認性）
\setmainjfont{BIZ UDMincho}         \setsansjfont{BIZ UDGothic}
```

---

## §C　和文その他書体（丸ゴシック / 楷書 / 行書 / 教科書体）

> 装飾・見出し・特殊用途向け書体。本文には不向きな場合が多い。  
> `\newfontfamily` で追加フォントとして定義すると任意箇所に適用できる。  
> 例 : `\newfontfamily\kaiFont{HGSeikaishotaiPRO}` → 使用 : `{\kaiFont 漢字}`

| 書体区分 | フォント名（英語） | 和名 | 推奨 | 入手 | コピペ用コマンド | 形式 | 特徴・推奨用途 |
|---|---|---|:---:|:---:|---|:---:|---|
| 丸ゴシック | Honoka Shin Antique-Maru | ほのか新アンティーク丸 | ★★☆ | `別途` | `\newfontfamily\maruFont{Honoka Shin Antique-Maru}` | OTF | 柔らかく温かみのある丸ゴシック。POP・子供向け・カジュアルな資料向け。 |
| 楷書体 | HGSeikaishotaiPRO | HG 正楷書体 PRO | ★★☆ | `Win` | `\newfontfamily\kaiFont{HGSeikaishotaiPRO}` | TTF | Windows/Office 同梱・正楷書体。証書・賞状・公文書の署名部分に最適。 |
| 行書体 | HGGyoshotai | HG 行書体 | ★★☆ | `Win` | `\newfontfamily\gyoFont{HGGyoshotai}` | TTC | Windows/Office 同梱・行書スタイル。見出し・タイトルのアクセントとして使用。 |
| 行書体 | HGPGyoshotai | HGP 行書体（プロポーショナル） | ★☆☆ | `Win` | `\newfontfamily\gyoPFont{HGPGyoshotai}` | TTC | プロポーショナル版行書体。横組みの見出しに自然な文字間隔で収まる。 |
| 教科書体 | UD Digi Kyokasho N | UD デジタル教科書体 N | ★★★ | `Win` | `\newfontfamily\kyoFont{UD Digi Kyokasho N}` | TTC | UD 設計・文科省準拠字形・Windows 搭載。教育教材・テキスト問題冊子に最適。 |
| 教科書体 | HGKyokashotai | HG 教科書体 | ★☆☆ | `Win` | `\newfontfamily\hgkyoFont{HGKyokashotai}` | TTC | Windows/Office 同梱の教科書体。UD デジ教科書体がない環境での代替として使用。 |

---

## §D　欧文セリフ体 推奨ランキング

**コマンド** : `\setmainfont{フォント名}`

> 欧文セリフ体は日本語本文と混植される欧文フォント。  
> 和文フォントとベースライン・x-height が揃うように `Scale=` で調整することが重要。

| # | フォント名 | 推奨 | 入手 | コピペ用コマンド | 形式 | 特徴・推奨用途 |
|:-:|---|:---:|:---:|---|:---:|---|
| 1 | TeX Gyre Termes | ★★★ | `TL` | `\setmainfont{TeX Gyre Termes}[Ligatures=TeX]` | OTF | TeX Live 同梱・Times New Roman 互換・合字対応・TeX との親和性最高。 |
| 2 | Libertinus Serif | ★★★ | `TL` | `\setmainfont{Libertinus Serif}[Ligatures=TeX]` | OTF | TeX Live 同梱・Linux Libertine 後継・OpenType フル対応・数式フォント対応。 |
| 3 | Linux Libertine O | ★★★ | `TL` | `\setmainfont{Linux Libertine O}[Ligatures=TeX]` | OTF | TeX Live 同梱・オープンソース・スモールキャプス・オールドスタイル数字対応。 |
| 4 | EB Garamond | ★★☆ | `TL` | `\setmainfont{EB Garamond}[Ligatures=TeX]` | OTF | TeX Live 同梱・ガラモン体の電子復刻・人文科学・書籍組版に最適。 |
| 5 | Palatino Linotype | ★★☆ | `Win` | `\setmainfont{Palatino Linotype}[Ligatures=TeX]` | TTF | Windows 標準・ルネッサンス書体・読みやすく格調高い。小冊子・論文向け。 |
| 6 | Times New Roman | ★★☆ | `Win` | `\setmainfont{Times New Roman}[Ligatures=TeX]` | TTF | Windows 標準・学術論文の標準フォント・高い普及率で互換性問題が少ない。 |
| 7 | Georgia | ★★☆ | `Win` | `\setmainfont{Georgia}[Ligatures=TeX]` | TTF | Windows 標準・スクリーン最適化済み・大きな x-height で可読性が高い。 |
| 8 | Playfair Display | ★☆☆ | `別途` | `\setmainfont{Playfair Display}[Ligatures=TeX]` | OTF | ハイコントラストなセリフ体・見出し専用。ファッション誌・エディトリアル向け。 |

---

## §E　欧文サンセリフ体 推奨ランキング

**コマンド** : `\setsansfont{フォント名}`

> 欧文サンセリフ体は見出し・キャプション・UI テキストに使用。  
> 和文ゴシック体と組み合わせて使うと字形の統一感が得られる。

| # | フォント名 | 推奨 | 入手 | コピペ用コマンド | 形式 | 特徴・推奨用途 |
|:-:|---|:---:|:---:|---|:---:|---|
| 1 | TeX Gyre Heros | ★★★ | `TL` | `\setsansfont{TeX Gyre Heros}[Ligatures=TeX]` | OTF | TeX Live 同梱・Helvetica 互換・クリーンな字形・幅広い用途に対応。 |
| 2 | Libertinus Sans | ★★★ | `TL` | `\setsansfont{Libertinus Sans}[Ligatures=TeX]` | OTF | TeX Live 同梱・Libertinus Serif との統一感が優れる・論文・書籍向け。 |
| 3 | Linux Biolinum O | ★★★ | `TL` | `\setsansfont{Linux Biolinum O}[Ligatures=TeX]` | OTF | TeX Live 同梱・Linux Libertine のサンセリフ対・人文系文書に最適。 |
| 4 | Open Sans | ★★☆ | `別途` | `\setsansfont{Open Sans}[Ligatures=TeX]` | TTF | Google Fonts 製・Web 標準・高可読性・6 ウェイト対応。プレゼン資料に最適。 |
| 5 | Roboto | ★★☆ | `別途` | `\setsansfont{Roboto}[Ligatures=TeX]` | OTF | Google Android 標準・モダンなジオメトリック体・12 ウェイト対応。 |
| 6 | Arial | ★★☆ | `Win` | `\setsansfont{Arial}[Ligatures=TeX]` | TTF | Windows 標準・最高の互換性・ビジネス文書の安全牌。字形はやや単調。 |
| 7 | Calibri | ★★☆ | `Win` | `\setsansfont{Calibri}[Ligatures=TeX]` | TTF | Windows/Office デフォルト・ヒューマニスト系・光学的な調整が精緻。 |
| 8 | Verdana | ★☆☆ | `Win` | `\setsansfont{Verdana}[Ligatures=TeX]` | TTF | スクリーン最適化・大きな x-height・低解像度でも読みやすい。 |
| 9 | Tahoma | ★☆☆ | `Win` | `\setsansfont{Tahoma}[Ligatures=TeX]` | TTF | Windows 標準・コンパクトな字形・ダイアログ等の UI テキスト向け。 |

---

## §F　欧文等幅体（コード・技術文書）

**コマンド** : `\setmonofont{フォント名}`

> 等幅フォントはソースコード・コマンドライン表示・表の数値整列に使用。  
> プログラミングリガチャ（`fi`/`fl` 等の合字）対応フォントはコード可読性が向上する。  
> `Scale=0.92` 程度に縮小すると和文フォントとのサイズバランスが整う。

| # | フォント名 | 推奨 | 入手 | コピペ用コマンド | 形式 | 特徴・推奨用途 |
|:-:|---|:---:|:---:|---|:---:|---|
| 1 | Inconsolata | ★★★ | `TL` | `\setmonofont{Inconsolata}[Scale=0.92]` | OTF | TeX Live 同梱・読みやすい等幅体・LaTeX 文書での実績が最も多い定番。 |
| 2 | JetBrains Mono | ★★★ | `別途` | `\setmonofont{JetBrains Mono}[Scale=0.92]` | OTF | プログラミング特化・リガチャ豊富・8 ウェイト・字形の区別が明確。 |
| 3 | Source Code Pro | ★★★ | `TL` | `\setmonofont{Source Code Pro}[Scale=0.92]` | OTF | TeX Live 同梱・Adobe 製・7 ウェイト対応・LaTeX 技術文書の標準的選択肢。 |
| 4 | Cascadia Code | ★★☆ | `別途` | `\setmonofont{Cascadia Code}[Scale=0.92]` | OTF | Microsoft 製・プログラミングリガチャ対応・Windows Terminal 標準フォント。 |
| 5 | Cascadia Mono | ★★☆ | `別途` | `\setmonofont{Cascadia Mono}[Scale=0.92]` | OTF | Cascadia Code のリガチャなし版。LaTeX 内でリガチャ不要な場合はこちら。 |
| 6 | DejaVu Sans Mono | ★★☆ | `TL` | `\setmonofont{DejaVu Sans Mono}[Scale=0.92]` | TTF | TeX Live 同梱・Unicode 対応・多言語コード表示に適している。 |
| 7 | Consolas | ★★☆ | `Win` | `\setmonofont{Consolas}[Scale=0.92]` | TTF | Windows 標準・Visual Studio デフォルト・可読性の高い等幅体。 |
| 8 | Courier New | ★☆☆ | `Win` | `\setmonofont{Courier New}[Scale=0.92]` | TTF | 最高の互換性・タイプライター風字形。Word 等との互換が必要な文書向け。 |

### 和文＋欧文＋等幅の最推奨セット（TeX Live 同梱のみ）

```latex
\setmainjfont{Harano Aji Mincho}    \setsansjfont{Harano Aji Gothic}
\setmainfont{TeX Gyre Termes}[Ligatures=TeX]
\setsansfont{TeX Gyre Heros}[Ligatures=TeX]
\setmonofont{Inconsolata}[Scale=0.92]
```

---

## §G　推奨フォントペアリング早見表（和欧混植・用途別最適組み合わせ）

> 和文フォントと欧文フォントの組み合わせ（ペアリング）は字形・ウェイト・x-height のバランスが重要。  
> 下記の組み合わせは実用・美観の両面で検証済みの推奨セット。

| 用途 | 和文明朝 (`\setmainjfont`) | 和文ゴシック (`\setsansjfont`) | 欧文 (`\setmainfont`) | 特性・推奨理由 |
|---|---|---|---|---|
| 学術論文・書籍 | Harano Aji Mincho | Harano Aji Gothic | TeX Gyre Termes | TeX Live 同梱のみで完結。IVS 対応・AJ1-7 準拠の最高品質セット。 |
| 公文書・報告書 | BIZ UDMincho | BIZ UDGothic | Calibri | Windows 標準のみで完結。UD 設計による高視認性・行政文書の標準。 |
| 文芸・小説 | Shippori Mincho | Gen Jyuu Gothic | Linux Libertine O | 美しい字形・読書体験を重視した文学的なセット。縦組みにも対応。 |
| 技術文書・マニュアル | Source Han Serif JP | Source Han Code JP | JetBrains Mono | コード・日本語・数式が混在する技術文書向け最強セット。 |
| Windows 環境一式 | Yu Mincho | Yu Gothic | Times New Roman | Windows 標準搭載フォントのみで美しい書籍品質を実現。追加不要。 |
| 縦組み・和綴じ | GenEi Chikugo Mincho v3 | Harano Aji Gothic | EB Garamond | 縦組み専用設計の和文＋格調高い欧文。詩集・俳句集に最適。 |
| 古文書・歴史資料 | IPAmjMincho | IPAexGothic | Libertinus Serif | 外字・異体字が最強クラスの IPAmj 明朝で古い文字も確実に出力。 |
| プレゼン・スライド | Noto Serif JP | Noto Sans JP | Open Sans | 7 ウェイト対応・Variable Font・スクリーン表示最適化の万能セット。 |

---

## §H　フォント確認・トラブルシューティング

| 状況・エラー | 対処法・確認コマンド |
|---|---|
| フォントが見つからないエラー | `! Package fontspec Error: The font "XXX" cannot be found.` |
| → 利用可能フォント一覧を確認 | コマンドプロンプト：`fc-list :lang=ja \| findstr /i "mincho"` |
| → ファイル名指定に変更 | `\setmainjfont{HaranoAjiMincho-Regular.otf}` （ファイル名で指定） |
| TTC フォントが正しく読めない | `\setmainjfont{Yu Mincho}[FontIndex=0]` （インデックス指定） |
| 太字が合成太字になる | `\setmainjfont{...}[BoldFont={別の太字.otf}]` （Bold ファイル明示指定） |
| 和欧間のスペースを調整 | `\ltjsetparameter{xkanjiskip={0.1em plus 0.15em minus 0.06em}}` |
| フォント名（Lua）を確認 | `\directlua{tex.print(font.getfont(font.current()).name or "")}` |
| インストール済みフォント一覧 | コマンドプロンプト：`fc-list :lang=ja \| sort` |
| TeX Live フォント一覧 | コマンドプロンプト：`luaotfload-tool --list=*:lang=ja` |

---

## フォント変更の手順（まとめ）

1. 上記の表でフォントを選ぶ
2. 「コピペ用コマンド」列のテキストをそのままコピー
3. 自分の `.tex` ファイルのプリアンブルに貼り付ける

```latex
% ▶ 和文フォント（明朝・ゴシック）
\setmainjfont{フォント名}  % 本文明朝体
\setsansjfont{フォント名}  % ゴシック体（見出し等）

% ▶ 欧文フォント（セリフ・サンセリフ・等幅）
\setmainfont{フォント名}   % 本文欧文
\setsansfont{フォント名}   % サンセリフ欧文
\setmonofont{フォント名}   % 等幅（コード等）

% ▶ ウェイト（太さ）指定例
\setmainjfont{Harano Aji Mincho}[
  BoldFont     = {Harano Aji Mincho},
  BoldFeatures = {FakeBold=2.5}  % 合成太字（Bold がない場合）
]
```

---

*TeX Live 2026 / LuaHBTeX / Windows — 出典 : `texlive_fonts.csv` + 厳選推奨フォント.md*
