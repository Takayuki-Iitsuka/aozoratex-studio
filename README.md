# AozoraTeX Studio

AozoraTeX Studio は、青空文庫の HTML/XHTML を LuaLaTeX（LuaTeX 系 LaTeX エンジン）向けの `.tex` と、端末別に最適化した PDF（Portable Document Format／携帯文書形式）へ変換する project（プロジェクト）です。

Web UI（Web User Interface／Web ユーザーインターフェース）と CLI（Command Line Interface／コマンドラインインターフェース）の両方から利用できます。縦書き組版に特化し、jlreq クラス + luatexja 系パッケージにより、美しい文庫本風 PDF を生成します。

## 主な機能

- HTML/XHTML から LuaLaTeX 用 `.tex` を生成（ルビ・外字・見出し・奥付対応）
- Next.js（React + TypeScript + Tailwind）によるモダン Web UI
- `latexmk` による PDF compile（PDF コンパイル）
- `smart`、`tablet`、`pc` の device profile（端末別プロファイル）＋ 縦横向き切替
- 背景色・文字色・フォント・和紙背景・外枠フレーム・表紙テクスチャ・段組などの高度な装飾管理
- カラーパレット・ライブプレビュー対応
- 包括的な HTML ドキュメント群（`static/docs/`）

## セットアップ

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

# Python 依存 (pyproject.toml 推奨)
# uv 推奨: uv pip install -e ".[dev]"
# または
pip install -r requirements.txt
# または (pyproject 利用時)
.venv\Scripts\pip.exe install -e ".[dev]"

# Node 依存（Next.js 用）
bun install   # または npm install
```

## 起動

```powershell
# 推奨（Bun / npm）
start_server.bat
# または
bun run dev
# または
npm run dev
```

ブラウザで次を開きます。

```text
http://localhost:3000
```

## CLI 実行例

```powershell
.venv\Scripts\python.exe -m src.aozoratex_cli data/1567_14913.html --device smart --out out
```

出力先は次の構成です。

- `.tex` と intermediate file（中間ファイル）: `out/work/<device>/`
- `.pdf`: `out/pdf/<device>/`

## ドキュメント

起動後に次を開きます。

```text
http://localhost:3000/static/docs/index.html
```

静的ファイルの入口は `static/docs/index.html` です。技術仕様・デバイス最適化・変換対応表・フォントカタログなどが整備されています。

## 主要ディレクトリ

```text
src/                    Python コア変換ロジック + API ブリッジ
src/app/                Next.js App Router（UI + API routes）
src/components/         React コンポーネント
src/lib/                フック・API クライアント
static/docs/            包括的 HTML ドキュメント
static/assets/          表紙・和紙などの公開静的画像資産
static/                 カラーパレット・ベンダー資産・静的ドキュメント
config/                 設定ファイル（*.default.ini / *.custom.ini）
data/                   入力用青空文庫 HTML/XHTML サンプル
out/                    生成物（.tex / .pdf）
tests/                  テスト
tools/                  補助ツール（フォント一覧生成など）
```

## 現行アーキテクチャ（2026年時点・レビュー後改善適用）

- **Frontend**: Next.js 16 (Turbopack) + React 19 + TypeScript + Tailwind CSS 4 + motion (旧 framer-motion) + lucide-react + zod 4 (validation) + sonner (toast)
- **Backend bridge**: Next.js API Routes → `src/api_bridge.py`（Python プロセス spawn）。実験的 FastAPI長寿命サーバー雛形 `src/server_fastapi.py` あり
- **Core logic**: `src/aozoratex.py`（BeautifulSoup パース → LaTeX 変換）、`src/server_services.py`（生成・コンパイル・フォント・色管理）
- **Settings**: `src/settings_store.py`（default/custom INI マージ） + pyproject.toml (pydantic準備)
- **TeX**: LuaLaTeX + jlreq（tate） + luatexja 系 + TikZ 装飾 + .latexmkrc
- **Runtime**: Windows + PowerShell 7 + TeX Live 2026 + Python 3.14 + Bun / Node
- **追加ツール**: prettier, ruff (推奨), uv (推奨)

## 開発メモ

- 旧 Flask サーバー構成（`src/aozora_server.py`）から Next.js + Python ブリッジ構成へ移行済み。
- 2026年レビューにより、pyproject.toml、zodバリデーション、.latexmkrc、FastAPI実験的ブリッジを導入。
- ドキュメントはすべて最新構成に更新されています。古い参照は削除・注記済み。
- TeX（テック）処理は LuaLaTeX と LuaTeX-ja 系 package（パッケージ）を使います。
- コードコメントは日本語で記述しています（プロジェクト規約）。
- 推奨ツール: `bun run format`, `uv` (Python), `ruff`。詳細は plan.md を参照。
