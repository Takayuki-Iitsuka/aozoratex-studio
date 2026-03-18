# AozoraTeX Studio

青空文庫の HTML/XHTML を、デバイス最適化された縦書き PDF/TEX に変換するプロジェクトです。  
Web UI と CLI の両方を提供し、配色・サイズ・フォント設定を保存して再利用できます。

## 主な機能

- HTML/XHTML → LuaLaTeX 用 `.tex` 生成
- Web UI からの PDF 生成（`latexmk` 使用）
- デバイス別設定（サイズ・余白・行間・字間・モード）
- 背景色/文字色の視覚確認と保存
- 統合色一覧 `colors.html`（色相順）
- デバイスと用紙サイズの視覚比較 `device-paper-size-map.html`
- 補助ツール
  - LuaLaTeX 利用可能フォント抽出
  - TeX ログ解析（Markdown + JSON レポート）

## ディレクトリ構成

```text
aozoratex-studio/
├── start_server.bat               # Windows 起動バッチ
├── src/
│   ├── aozora_server.py           # Flask サーバー本体（python -m src.aozora_server）
│   ├── aozoratex.py               # 変換本体（python -m src.aozoratex）
│   └── settings_store.py          # 設定読み書き本体
├── config/
│   ├── global_settings.default.ini
│   ├── global_settings.custom.ini
│   ├── device_settings.default.ini
│   ├── device_settings.custom.ini
├── static/
│   ├── index.html
│   ├── color-palettes.json
│   ├── color-palettes.js
│   ├── css/
│   │   └── index.css
│   ├── js/
│   │   └── index.js
│   └── docs/
│       ├── index.html
│       ├── docs-common.css
│       ├── docs-index.css
│       ├── color/
│       ├── conversion/
│       ├── device/
│       ├── project/
│       └── markdown/
├── tools/
│   ├── fonts/
│   │   ├── texlive_font_list.py
│   │   └── texlive_fonts.csv
│   └── logs/
│       └── tex_log_parser.py
├── data/                          # 入力HTML
└── out/                           # 出力物
```

## セットアップ

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 実行方法

### Web UI

```powershell
python -m src.aozora_server
```

ブラウザで `http://localhost:5000` を開いてください。  
Windows では `start_server.bat` でも起動できます。

### CLI

```powershell
python -m src.aozoratex data/92_14545.html --device iphone --mode light --out out/iphone
```

設定保存:

```powershell
python -m src.aozoratex data/92_14545.html --device iphone --mode dark --bg-color "#101010" --fg-color "#F5F5F5" --save-settings
```

カスタム設定初期化:

```powershell
python -m src.aozoratex data/92_14545.html --device iphone --reset-settings
```

## 設定ファイル

- `*.default.ini`: 標準設定（初期値）
- `*.custom.ini`: Web/CLI で保存されたカスタム設定

初期フォント名は `global_settings.default.ini` の `font_family` で一元管理しています。
`device_settings.default.ini` の `font_size` はデバイス別の本文サイズ設定です。

読み込み順は `default -> custom` です。  
`custom` を消す、または `/api/settings/reset` で初期値に戻せます。

## 配色とサイズの確認ページ

- 統合配色一覧: `http://localhost:5000/colors.html`
- サイズ比較: `http://localhost:5000/device-paper-size-map.html`

## 補助ツール

### フォント抽出

```powershell
python tools/fonts/texlive_font_list.py --output tools/fonts/texlive_fonts.csv
```

### TeX ログ解析

```powershell
python tools/logs/tex_log_parser.py out/iphone/*.log
```

出力先: `out/reports/tex_logs/`

## ドキュメント

- ブラウザ版: `http://localhost:5000/docs`
- 変換済みHTML版: `http://localhost:5000/static/docs/markdown/index.html`
