import fs from "node:fs/promises";
import path from "node:path";
import type React from "react";
import Link from "next/link";
import { ExternalLink, Info, Layers, Library, TerminalSquare, Wrench } from "lucide-react";

type PackageJson = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const IMPORTANT_NODE_PACKAGES = [
  "next",
  "react",
  "react-dom",
  "typescript",
  "tailwindcss",
  "lucide-react",
  "next-themes",
  "sonner",
  "zod",
  "motion",
];

const PYTHON_PACKAGES = [
  "beautifulsoup4",
  "lxml",
  "markdown",
  "fontTools",
  "pydantic",
  "pydantic-settings",
  "fastapi",
  "uvicorn[standard]",
  "pytest",
  "ruff",
  "mypy",
];

async function readPackageJson(): Promise<PackageJson> {
  const text = await fs.readFile(path.join(process.cwd(), "package.json"), "utf-8");
  return JSON.parse(text) as PackageJson;
}

async function readPyproject(): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "pyproject.toml"), "utf-8");
}

function dependencyVersion(pkg: PackageJson, name: string): string {
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? "-";
}

function pythonDependencyLine(pyproject: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = pyproject.match(new RegExp(`"${escaped}([^"]*)"`));
  return match ? `${name}${match[1]}` : "-";
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function DependencyTable({
  rows,
}: {
  rows: Array<{ name: string; version: string; role: string }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-semibold">Name（名称）</th>
            <th className="text-left px-4 py-3 font-semibold">Version（バージョン）</th>
            <th className="text-left px-4 py-3 font-semibold">Role（役割）</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.name} className="bg-input/20">
              <td className="px-4 py-3 font-mono text-xs">{row.name}</td>
              <td className="px-4 py-3 font-mono text-xs text-accent">{row.version}</td>
              <td className="px-4 py-3 text-muted-foreground">{row.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SystemInfoPage() {
  const [pkg, pyproject] = await Promise.all([readPackageJson(), readPyproject()]);

  const nodeRows = IMPORTANT_NODE_PACKAGES.map((name) => ({
    name,
    version: dependencyVersion(pkg, name),
    role:
      {
        next: "App Router（アプリルーター）と Route Handler（ルートハンドラー）を含む Web framework（Web フレームワーク）",
        react: "UI（ユーザーインターフェース）構築 library（ライブラリ）",
        "react-dom": "DOM rendering（DOM 描画）",
        typescript: "Typed JavaScript（型付き JavaScript）",
        tailwindcss: "Utility-first CSS framework（ユーティリティ優先 CSS フレームワーク）",
        "lucide-react": "Icon（アイコン）library（ライブラリ）",
        "next-themes": "Theme switching（テーマ切替）",
        sonner: "Toast notification（通知）",
        zod: "Schema validation（スキーマ検証）",
        motion: "Animation（アニメーション）library（ライブラリ）",
      }[name] ?? "Application dependency（アプリケーション依存関係）",
  }));

  const pythonRows = PYTHON_PACKAGES.map((name) => ({
    name,
    version: pythonDependencyLine(pyproject, name),
    role:
      {
        beautifulsoup4: "青空文庫 HTML/XHTML parsing（解析）",
        lxml: "高速 HTML/XML parser（パーサー）",
        markdown: "Markdown（マークダウン）変換",
        fontTools: "Font（フォント）解析と外字調査",
        pydantic: "Data validation（データ検証）",
        "pydantic-settings": "Settings（設定）読み込み",
        fastapi: "実験的 Python bridge（Python ブリッジ）",
        "uvicorn[standard]": "ASGI server（ASGI サーバー）",
        pytest: "Test runner（テスト実行）",
        ruff: "Python linter（静的検査）",
        mypy: "Python type checker（型検査）",
      }[name] ?? "Python dependency（Python 依存関係）",
  }));

  const scripts = Object.entries(pkg.scripts ?? {});

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Info size={14} />
            System Inventory（システム構成一覧）
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">システム情報</h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            AozoraTeX Studio の language（言語）、framework（フレームワーク）、
            library（ライブラリ）、tool（ツール）を現在の設定ファイルから整理して表示します。
            確認日: 2026年（皇紀2686年・令和8年）7月4日。
          </p>
        </div>
        <a
          href="/static/docs/system-info.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-semibold hover:bg-muted/70 transition"
        >
          静的ドキュメントを開く
          <ExternalLink size={14} />
        </a>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-1">
          <div className="text-xs text-muted-foreground">Project（プロジェクト）</div>
          <div className="text-lg font-bold">{pkg.name ?? "aozoratex-studio"}</div>
          <div className="text-xs text-muted-foreground">Version（バージョン）: {pkg.version ?? "-"}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-1">
          <div className="text-xs text-muted-foreground">Frontend（フロントエンド）</div>
          <div className="text-lg font-bold">Next.js {dependencyVersion(pkg, "next")}</div>
          <div className="text-xs text-muted-foreground">React {dependencyVersion(pkg, "react")}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-1">
          <div className="text-xs text-muted-foreground">Typesetting（組版）</div>
          <div className="text-lg font-bold">LuaLaTeX + jlreq</div>
          <div className="text-xs text-muted-foreground">Python bridge（Python ブリッジ）経由で実行</div>
        </div>
      </div>

      <InfoCard icon={<Layers size={18} />} title="Architecture（構成）">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-muted-foreground leading-relaxed">
          <div className="rounded-xl border border-border bg-input/30 p-4">
            <div className="font-semibold text-foreground mb-1">UI / API Layer（UI・API 層）</div>
            <p>
              Next.js App Router（アプリルーター）で page（ページ）と API Route
              Handler（API ルートハンドラー）を提供します。
            </p>
          </div>
          <div className="rounded-xl border border-border bg-input/30 p-4">
            <div className="font-semibold text-foreground mb-1">Conversion Layer（変換層）</div>
            <p>
              TypeScript（TypeScript 言語）側から Python bridge（Python ブリッジ）を
              spawn（子プロセス起動）し、青空文庫 HTML を LaTeX/PDF に変換します。
            </p>
          </div>
        </div>
      </InfoCard>

      <InfoCard icon={<Library size={18} />} title="Node / Frontend Dependencies（Node・フロントエンド依存）">
        <DependencyTable rows={nodeRows} />
      </InfoCard>

      <InfoCard icon={<Wrench size={18} />} title="Python / Backend Dependencies（Python・バックエンド依存）">
        <DependencyTable rows={pythonRows} />
      </InfoCard>

      <InfoCard icon={<TerminalSquare size={18} />} title="Scripts（実行コマンド）">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scripts.map(([name, command]) => (
            <div key={name} className="rounded-xl border border-border bg-input/30 p-4">
              <div className="text-sm font-bold">{name}</div>
              <code className="mt-2 block break-all text-xs text-accent">{command}</code>
            </div>
          ))}
        </div>
      </InfoCard>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/system-status"
          className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground hover:opacity-90 transition"
        >
          システム状況を見る
        </Link>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-semibold hover:bg-muted/70 transition"
        >
          設定へ移動
        </Link>
      </div>
    </div>
  );
}
