# PDFビューア：スマートフォン向けページめくり設定

スマートフォンで縦書きPDFを閲覧する際の「左右スワイプによるページめくり」を実現するための、LuaLaTeX側の設定と PDF Viewer（PDFビューア）側の対応策をまとめます。

---

## 1. 結論：権限と役割の分離

| 役割 | 担当 | 説明 |
|---|---|---|
| **表示制御の主役** | PDF Viewerアプリ | 最終的な描画とスクロール方向の決定権はビューア側にある。 |
| **推奨設定の埋め込み** | LuaLaTeX (hyperref) | Viewer Preferences（ビューアの初期表示設定）を PDF Metadata（メタデータ）として埋め込み、ビューアへヒントを伝達する。 |

> [!IMPORTANT]
> LuaLaTeX側の設定はあくまでビューアへの「**推奨**」であり、アプリ側のユーザー設定が常に優先されます。

---

## 2. LuaLaTeX側の設定（Metadataの埋め込み）

`hyperref` パッケージを使用して PDF Metadata を付与します。

| 設定項目 | キー | 説明 |
|---|---|---|
| 単一ページ表示 | `pdfpagelayout=SinglePage` | 連続スクロールをオフにし、1画面に1ページのみを表示。左右スワイプが誘発されやすくなる。 |
| 見開き表示（右開き） | `pdfpagelayout=TwoPageRight` | 縦書き日本語文書向け。右から左へめくる動作を想定したレイアウト。 |
| 綴じ方向（右→左） | `pdfdirection=R2L` | Right-to-Left（日本語縦書き用）。 |

```latex
\usepackage[
  pdfpagelayout=SinglePage,
  pdfpagelabels=true,
  pdfdirection=R2L,    % 右→左（日本語縦書き）
  pdfview=Fit,
]{hyperref}
```

---

## 3. PDF Viewerアプリ別の対応方法

| ビューアアプリ | 設定箇所 |
|---|---|
| **Adobe Acrobat Reader（モバイル）** | 設定 → 表示設定 → スクロール方向 → 「横」 |
| **PDF Expert（iOS）** | ツールバー → 表示モード → 横スクロール |
| **Xodo** | メニュー → 表示 → ページモード |
| **GoodReader** | 表示設定 → Scroll Direction → Horizontal |
| **Apple Books** | PDF読み込み時にデフォルトで水平スクロールが適用される場合が多い。 |
| **Google Drive PDF Viewer** | 垂直スクロールに固定されており変更できない場合がある。 |

---

## 4. 実用的なアプローチ（推奨順）

### ① ビューアアプリを変える（最も確実）
左右スワイプに対応したアプリを選ぶのが最も確実です。Adobe Acrobat Reader や PDF Expert は設定で切り替え可能です。

### ② LuaLaTeXにMetadataを埋め込む（補助的）
```latex
\hypersetup{
  pdfpagelayout=SinglePage,
  pdfdirection=R2L,
}
```
ビューアが対応している場合に自動反映されます。

### ③ 配布時のガイドライン明記
読者に対して「ビューアの表示設定を『単一ページ』に変更してください」と注記することを推奨します。

---

## 5. 別の視点：EPUBへの移行検討

スマートフォンでの「左右のページめくり動作」を最優先とするならば、固定レイアウトである PDF（Portable Document Format）自体がモバイル端末の多様な画面サイズに適合していない可能性があります。

Reflow（リフロー）機能を備えた **EPUB** や **HTML** は、画面サイズに合わせてレイアウトが自動調整されるため、モバイルでの読書体験としてより合理的です。

| ツール | 用途 |
|---|---|
| `make4ht` | LaTeX → HTML 変換 |
| `tex4ebook` | LaTeX → EPUB 変換 |

---

## 6. メリット・デメリット・リスクの整理

| 観点 | 内容 |
|---|---|
| **メリット** | PDF Viewerがメタデータに対応している場合、読者が設定変更なしに自動的に左右めくりで閲覧を開始できる。意図したレイアウト（1画面1ページ）で正確に情報を伝達できる。 |
| **デメリット** | 使用するPDF Viewerによってはメタデータが完全に無視され、作成者の意図通りに表示されない場合がある。 |
| **リスク** | 読者が設定変更の方法を知らない場合、「縦スクロールできない不便なファイル」と誤解され、離脱のリスクがある。作成者が特定のページめくり方向を強制した場合、読者の使い慣れたデフォルト設定（縦スクロール）を意図せず上書きしてしまう可能性がある。 |

---

**情報源・根拠:**
- Adobe PDF Reference, Sixth Edition (ViewerPreferences dictionary)
- CTAN (The Comprehensive TeX Archive Network) hyperref manual

*※ この文書は、「LuaLaTeX PDFスマホ向け左右ページめくり.md」および「フォントのサイズ自動化.md」のPDFビューア設定部分を統合・整理したものです。*
