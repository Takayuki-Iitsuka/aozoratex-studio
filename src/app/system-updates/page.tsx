"use client";

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Loader2,
  Package,
  Play,
  RefreshCw,
  Shield,
  Terminal,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToolVersionInfo = {
  name: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  updateCommand: string;
  category: "runtime" | "package-manager" | "typesetting";
};

type OutdatedPackage = {
  name: string;
  currentVersion: string;
  wantedVersion: string;
  latestVersion: string;
  packageManager: "npm" | "pip";
  updateCommand: string;
};

type ExecuteResult = {
  success: boolean;
  command: string;
  output: string;
  exitCode: number | null;
  durationMs: number;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const categoryLabel: Record<string, string> = {
  runtime: "ランタイム",
  "package-manager": "パッケージマネージャ",
  typesetting: "組版エンジン",
};

const categoryIcon: Record<string, React.ReactNode> = {
  runtime: <Shield size={15} />,
  "package-manager": <Package size={15} />,
  typesetting: <Wrench size={15} />,
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-lg font-bold">
        <span className="text-accent">{icon}</span>
        {title}
        {badge}
      </div>
      {children}
    </div>
  );
}

function Badge({
  count,
  tone = "accent",
}: {
  count: number;
  tone?: "accent" | "warn" | "success";
}) {
  const colors = {
    accent: "bg-accent/15 text-accent border-accent/30",
    warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${colors[tone]}`}
    >
      {count}
    </span>
  );
}

function CommandDisplay({
  command,
  running,
  onRun,
}: {
  command: string;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-950 border border-border px-3 py-2">
      <code className="flex-1 text-[11px] font-mono text-emerald-400/90 break-all select-all">
        $ {command}
      </code>
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="shrink-0 inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-bold text-accent-foreground hover:opacity-90 disabled:opacity-50 transition"
      >
        {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
        実行
      </button>
    </div>
  );
}

function OutputPanel({ result }: { result: ExecuteResult }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="mt-2 rounded-xl border border-border bg-zinc-950 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-zinc-900 transition"
      >
        <span className="flex items-center gap-2">
          <Terminal size={12} />
          実行結果
          <span
            className={`font-mono ${result.exitCode === 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            exit {result.exitCode ?? "N/A"}
          </span>
          <span className="text-muted-foreground/60">{result.durationMs}ms</span>
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div className="max-h-48 overflow-y-auto px-3 pb-3">
          <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">
            {result.output || "(出力なし)"}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolCard({
  tool,
  onExecute,
}: {
  tool: ToolVersionInfo;
  onExecute: (command: string, type: string) => Promise<ExecuteResult | null>;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await onExecute(tool.updateCommand, tool.category === "typesetting" ? "tlmgr" : "system");
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-5 space-y-3 transition ${
        tool.updateAvailable
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-accent">{categoryIcon[tool.category]}</span>
            <span className="font-bold text-sm">{tool.name}</span>
            <span className="rounded-full border border-border bg-input px-2 py-0.5 text-[10px] text-muted-foreground">
              {categoryLabel[tool.category]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              現在: <span className="font-mono text-foreground">{tool.currentVersion}</span>
            </span>
            <span className="text-muted-foreground">
              最新: <span className="font-mono text-foreground">{tool.latestVersion}</span>
            </span>
          </div>
        </div>
        {tool.updateAvailable ? (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <ArrowDownToLine size={12} />
            更新あり
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={12} />
            最新
          </span>
        )}
      </div>

      {tool.updateAvailable && tool.updateCommand && !tool.updateCommand.startsWith("Download") && (
        <CommandDisplay command={tool.updateCommand} running={running} onRun={handleRun} />
      )}
      {tool.updateAvailable && tool.updateCommand && tool.updateCommand.startsWith("Download") && (
        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Download size={13} />
          {tool.updateCommand}
        </div>
      )}

      {result && <OutputPanel result={result} />}
    </div>
  );
}

function PackageRow({
  pkg,
  onExecute,
}: {
  pkg: OutdatedPackage;
  onExecute: (command: string, type: string) => Promise<ExecuteResult | null>;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await onExecute(pkg.updateCommand, pkg.packageManager);
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-input/20 px-4 py-3">
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            pkg.packageManager === "npm"
              ? "border-red-500/30 text-red-500 bg-red-500/10"
              : "border-sky-500/30 text-sky-500 bg-sky-500/10"
          }`}
        >
          {pkg.packageManager}
        </span>
        <span className="font-mono text-xs font-semibold flex-1 min-w-0 truncate">{pkg.name}</span>
        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
          {pkg.currentVersion}
        </span>
        <span className="text-muted-foreground text-[11px]">→</span>
        <span className="text-[11px] text-accent font-mono font-bold shrink-0">
          {pkg.latestVersion}
        </span>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted/70 disabled:opacity-50 transition"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          更新
        </button>
      </div>
      {result && <OutputPanel result={result} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bulk update helpers                                                */
/* ------------------------------------------------------------------ */

function BulkActions({
  npmCount,
  pipCount,
  onBulkNpm,
  onBulkPip,
  running,
}: {
  npmCount: number;
  pipCount: number;
  onBulkNpm: () => void;
  onBulkPip: () => void;
  running: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {npmCount > 0 && (
        <button
          type="button"
          onClick={onBulkNpm}
          disabled={!!running}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition"
        >
          {running === "npm" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          npm を一括更新 ({npmCount})
        </button>
      )}
      {pipCount > 0 && (
        <button
          type="button"
          onClick={onBulkPip}
          disabled={!!running}
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 disabled:opacity-50 transition"
        >
          {running === "pip" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          pip を一括更新 ({pipCount})
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SystemUpdatesPage() {
  // Version check state
  const [tools, setTools] = useState<ToolVersionInfo[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsCheckedAt, setToolsCheckedAt] = useState<string | null>(null);

  // Outdated packages state
  const [npmPackages, setNpmPackages] = useState<OutdatedPackage[]>([]);
  const [pipPackages, setPipPackages] = useState<OutdatedPackage[]>([]);
  const [outdatedLoading, setOutdatedLoading] = useState(false);
  const [outdatedCheckedAt, setOutdatedCheckedAt] = useState<string | null>(null);

  // Bulk action state
  const [bulkRunning, setBulkRunning] = useState<string | null>(null);

  /* ---- Data fetching ---- */

  const checkToolVersions = useCallback(async () => {
    setToolsLoading(true);
    try {
      const res = await fetch("/api/system/updates/check", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTools(data.tools ?? []);
      setToolsCheckedAt(data.checkedAt ?? null);
      const updatable = (data.tools ?? []).filter((t: ToolVersionInfo) => t.updateAvailable).length;
      if (updatable > 0) {
        toast.warning(`${updatable} 件のツールに更新があります。`, { duration: 5000 });
      } else {
        toast.success("すべてのツールが最新です。");
      }
    } catch (err) {
      toast.error(`バージョンチェックに失敗しました: ${err instanceof Error ? err.message : err}`);
    } finally {
      setToolsLoading(false);
    }
  }, []);

  const checkOutdated = useCallback(async () => {
    setOutdatedLoading(true);
    try {
      const res = await fetch("/api/system/updates/outdated", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNpmPackages(data.npm ?? []);
      setPipPackages(data.pip ?? []);
      setOutdatedCheckedAt(data.checkedAt ?? null);
      const total = data.totalOutdated ?? 0;
      if (total > 0) {
        toast.warning(`${total} 件の outdated パッケージが見つかりました。`, { duration: 5000 });
      } else {
        toast.success("すべてのパッケージが最新です。");
      }
    } catch (err) {
      toast.error(`パッケージチェックに失敗しました: ${err instanceof Error ? err.message : err}`);
    } finally {
      setOutdatedLoading(false);
    }
  }, []);

  /* ---- Run all checks on mount ---- */

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkToolVersions();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkOutdated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Execute a single command ---- */

  const executeCommand = useCallback(
    async (command: string, type: string): Promise<ExecuteResult | null> => {
      try {
        const res = await fetch("/api/system/updates/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, type }),
        });
        const data = (await res.json()) as ExecuteResult & { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? `実行に失敗しました (HTTP ${res.status})`);
          return null;
        }
        if (data.success) {
          toast.success(`コマンド完了: ${command}`);
        } else {
          toast.warning(`コマンドが異常終了しました (exit ${data.exitCode})`);
        }
        return data;
      } catch (err) {
        toast.error(`実行エラー: ${err instanceof Error ? err.message : err}`);
        return null;
      }
    },
    []
  );

  /* ---- Bulk updates ---- */

  const runBulkNpm = useCallback(async () => {
    if (!confirm("npm の全 outdated パッケージを更新します。よろしいですか？")) return;
    setBulkRunning("npm");
    await executeCommand("npm update", "npm");
    await checkOutdated();
    setBulkRunning(null);
  }, [executeCommand, checkOutdated]);

  const runBulkPip = useCallback(async () => {
    if (!confirm("pip の全 outdated パッケージを更新します。よろしいですか？")) return;
    setBulkRunning("pip");
    const names = pipPackages.map((p) => p.name).join(" ");
    if (names) {
      await executeCommand(`pip install --upgrade ${names}`, "pip");
    }
    await checkOutdated();
    setBulkRunning(null);
  }, [executeCommand, checkOutdated, pipPackages]);

  /* ---- Render helpers ---- */

  const updatableCount = tools.filter((t) => t.updateAvailable).length;
  const totalOutdated = npmPackages.length + pipPackages.length;

  const formatTime = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "medium" }).format(
          new Date(iso)
        )
      : "-";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Download size={14} />
            System Updates（システム更新）
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            アップデート管理
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Node.js・Python・LaTeX などのランタイム、および npm / pip
            の依存パッケージのバージョンを確認し、UI からワンクリックで更新できます。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void checkToolVersions();
              void checkOutdated();
            }}
            disabled={toolsLoading || outdatedLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-semibold hover:bg-muted/70 disabled:opacity-60 transition"
          >
            <RefreshCw
              size={14}
              className={toolsLoading || outdatedLoading ? "animate-spin" : ""}
            />
            すべて再チェック
          </button>
        </div>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-1">
          <div className="text-xs text-muted-foreground">ツール更新</div>
          <div className="text-lg font-bold flex items-center gap-2">
            {updatableCount > 0 ? (
              <>
                <TriangleAlert size={18} className="text-amber-500" />
                {updatableCount} 件の更新あり
              </>
            ) : tools.length > 0 ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-500" />
                すべて最新
              </>
            ) : (
              "チェック中…"
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={11} />
            {formatTime(toolsCheckedAt)}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-1">
          <div className="text-xs text-muted-foreground">npm outdated</div>
          <div className="text-lg font-bold flex items-center gap-2">
            {npmPackages.length > 0 ? (
              <>
                <TriangleAlert size={18} className="text-amber-500" />
                {npmPackages.length} パッケージ
              </>
            ) : outdatedCheckedAt ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-500" />
                すべて最新
              </>
            ) : (
              "チェック中…"
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={11} />
            {formatTime(outdatedCheckedAt)}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-1">
          <div className="text-xs text-muted-foreground">pip outdated</div>
          <div className="text-lg font-bold flex items-center gap-2">
            {pipPackages.length > 0 ? (
              <>
                <TriangleAlert size={18} className="text-amber-500" />
                {pipPackages.length} パッケージ
              </>
            ) : outdatedCheckedAt ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-500" />
                すべて最新
              </>
            ) : (
              "チェック中…"
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={11} />
            {formatTime(outdatedCheckedAt)}
          </div>
        </div>
      </div>

      {/* Tool version section */}
      <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
        <SectionHeader
          icon={<Shield size={18} />}
          title="ツール・ランタイム バージョン"
          badge={
            updatableCount > 0 ? (
              <Badge count={updatableCount} tone="warn" />
            ) : tools.length > 0 ? (
              <Badge count={tools.length} tone="success" />
            ) : undefined
          }
        >
          <button
            type="button"
            onClick={checkToolVersions}
            disabled={toolsLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/70 disabled:opacity-50 transition"
          >
            <RefreshCw size={13} className={toolsLoading ? "animate-spin" : ""} />
            再チェック
          </button>
        </SectionHeader>

        {toolsLoading && tools.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            バージョン情報を取得中…
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} onExecute={executeCommand} />
          ))}
        </div>
      </section>

      {/* Outdated packages section */}
      <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
        <SectionHeader
          icon={<Package size={18} />}
          title="Outdated パッケージ"
          badge={
            totalOutdated > 0 ? (
              <Badge count={totalOutdated} tone="warn" />
            ) : outdatedCheckedAt ? (
              <Badge count={0} tone="success" />
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            <BulkActions
              npmCount={npmPackages.length}
              pipCount={pipPackages.length}
              onBulkNpm={runBulkNpm}
              onBulkPip={runBulkPip}
              running={bulkRunning}
            />
            <button
              type="button"
              onClick={checkOutdated}
              disabled={outdatedLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2 text-xs font-semibold hover:bg-muted/70 disabled:opacity-50 transition"
            >
              <RefreshCw size={13} className={outdatedLoading ? "animate-spin" : ""} />
              再チェック
            </button>
          </div>
        </SectionHeader>

        {outdatedLoading && totalOutdated === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Loader2 size={16} className="animate-spin" />
            outdated パッケージを検出中…
          </div>
        )}

        {totalOutdated === 0 && outdatedCheckedAt && !outdatedLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            すべてのパッケージが最新です。
          </div>
        )}

        {npmPackages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <span className="rounded-md border border-red-500/30 text-red-500 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold">
                NPM
              </span>
              {npmPackages.length} パッケージ
            </h3>
            <div className="space-y-2">
              {npmPackages.map((pkg) => (
                <PackageRow key={pkg.name} pkg={pkg} onExecute={executeCommand} />
              ))}
            </div>
          </div>
        )}

        {pipPackages.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
              <span className="rounded-md border border-sky-500/30 text-sky-500 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold">
                PIP
              </span>
              {pipPackages.length} パッケージ
            </h3>
            <div className="space-y-2">
              {pipPackages.map((pkg) => (
                <PackageRow key={pkg.name} pkg={pkg} onExecute={executeCommand} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
