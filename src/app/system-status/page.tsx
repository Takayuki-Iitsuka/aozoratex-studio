"use client";

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Server,
} from "lucide-react";
import { toast } from "sonner";

type DiskStatus =
  | {
      available: true;
      path: string;
      totalBytes: number;
      usedBytes: number;
      freeBytes: number;
      usedPercent: number;
    }
  | {
      available: false;
      path: string;
      error: string;
    };

type SystemStatus = {
  success: true;
  checkedAt: string;
  server: {
    status: "running";
    pid: number;
    platform: string;
    nodeVersion: string;
    uptimeSeconds: number;
    cwd: string;
  };
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
    loadAverage: number[];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
    processHeapTotalBytes: number;
  };
  disk: DiskStatus;
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [
    days > 0 ? `${days}日` : "",
    hours > 0 ? `${hours}時間` : "",
    minutes > 0 ? `${minutes}分` : "",
    `${rest}秒`,
  ]
    .filter(Boolean)
    .join(" ");
}

function Meter({ value, tone = "accent" }: { value: number; tone?: "accent" | "warn" | "danger" }) {
  const color =
    tone === "danger" ? "bg-rose-500" : tone === "warn" ? "bg-amber-500" : "bg-accent";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function toneFor(value: number): "accent" | "warn" | "danger" {
  if (value >= 90) return "danger";
  if (value >= 75) return "warn";
  return "accent";
}

function StatusCard({
  title,
  icon,
  value,
  detail,
  percent,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  detail: string;
  percent?: number;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="text-accent">{icon}</span>
          {title}
        </div>
        {typeof percent === "number" && (
          <span className="rounded-full border border-border bg-input px-2 py-1 text-xs font-mono">
            {percent.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-xl font-extrabold">{value}</div>
        <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
        {typeof percent === "number" && <Meter value={percent} tone={toneFor(percent)} />}
      </div>
    </section>
  );
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SystemStatus;
      setStatus(json);
      setError(null);
    } catch (err) {
      setStatus(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void loadStatus();
    }, 0);
    const intervalTimer = window.setInterval(() => {
      void loadStatus();
    }, 5000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, [loadStatus]);

  const runServerAction = async (action: "start" | "stop" | "restart") => {
    const labels = { start: "起動", stop: "停止", restart: "再起動" };
    if (action !== "start" && !confirm(`サーバーを${labels[action]}します。よろしいですか？`)) {
      return;
    }

    setActionLoading(action);
    try {
      const res = await fetch("/api/server/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error ?? `HTTP ${res.status}`);
      toast.success(json.message ?? `サーバー${labels[action]}コマンドを実行しました。`);
      if (action === "start") await loadStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  const checkedAt = status?.checkedAt
    ? new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(status.checkedAt))
    : "-";

  const diskPercent = status?.disk.available ? status.disk.usedPercent : undefined;
  const diskDetail =
    status?.disk.available === true
      ? `${formatBytes(status.disk.usedBytes)} / ${formatBytes(status.disk.totalBytes)} used（使用中）`
      : status?.disk.available === false
        ? status.disk.error
        : "取得できません。";

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Activity size={14} />
            Runtime Monitor（稼働監視）
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">システム状況</h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            現在稼働中の Next.js server（Next.js サーバー）の状態、CPU（CPU 使用率）、
            memory（メモリ）、disk（ディスク）を表示します。
          </p>
        </div>
        <button
          type="button"
          onClick={loadStatus}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-semibold hover:bg-muted/70 disabled:opacity-60 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          更新
        </button>
      </header>

      <section className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${status ? "bg-emerald-500" : "bg-rose-500"}`}
              />
              <span className="font-bold">
                {status ? "サーバー稼働中" : "サーバー応答なし"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              最終確認: {checkedAt}
              {error ? ` / error（エラー）: ${error}` : ""}
            </p>
            {!status && (
              <p className="text-xs text-muted-foreground">
                停止後はこの画面から API（アプリケーションプログラミングインターフェース）を呼べません。
                プロジェクトルートの <code className="text-accent">start_server.bat</code>{" "}
                で手動起動してください。
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => runServerAction("start")}
              disabled={!!actionLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted px-3 py-2.5 text-xs font-semibold hover:bg-muted/70 disabled:opacity-60 transition"
            >
              <Play size={14} />
              起動
            </button>
            <button
              type="button"
              onClick={() => runServerAction("restart")}
              disabled={!!actionLoading || !status}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 disabled:opacity-60 transition"
            >
              <RotateCw size={14} />
              再起動
            </button>
            <button
              type="button"
              onClick={() => runServerAction("stop")}
              disabled={!!actionLoading || !status}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 disabled:opacity-60 transition"
            >
              <Power size={14} />
              停止
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatusCard
          title="Server（サーバー）"
          icon={<Server size={17} />}
          value={status ? `PID ${status.server.pid}` : "停止中"}
          detail={
            status
              ? `${status.server.nodeVersion} / uptime（稼働時間） ${formatDuration(status.server.uptimeSeconds)}`
              : "応答がないため詳細を取得できません。"
          }
        />
        <StatusCard
          title="CPU（CPU 使用率）"
          icon={<Cpu size={17} />}
          value={status ? `${status.cpu.usagePercent.toFixed(1)}%` : "-"}
          detail={
            status
              ? `${status.cpu.cores} cores（コア） / load average（平均負荷） ${status.cpu.loadAverage.join(", ")}`
              : "取得できません。"
          }
          percent={status?.cpu.usagePercent}
        />
        <StatusCard
          title="Memory（メモリ）"
          icon={<MemoryStick size={17} />}
          value={status ? `${status.memory.usedPercent.toFixed(1)}%` : "-"}
          detail={
            status
              ? `${formatBytes(status.memory.usedBytes)} / ${formatBytes(status.memory.totalBytes)} used（使用中）`
              : "取得できません。"
          }
          percent={status?.memory.usedPercent}
        />
        <StatusCard
          title="Disk（ディスク）"
          icon={<HardDrive size={17} />}
          value={
            status?.disk.available
              ? `${status.disk.usedPercent.toFixed(1)}%`
              : status
                ? "未対応"
                : "-"
          }
          detail={diskDetail}
          percent={diskPercent}
        />
      </div>

      {status && (
        <section className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
          <h2 className="text-lg font-bold">Process Details（プロセス詳細）</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border bg-input/30 p-4">
              <div className="text-muted-foreground">Working Directory（作業ディレクトリ）</div>
              <code className="mt-1 block break-all text-accent">{status.server.cwd}</code>
            </div>
            <div className="rounded-xl border border-border bg-input/30 p-4">
              <div className="text-muted-foreground">Disk Path（ディスク対象）</div>
              <code className="mt-1 block break-all text-accent">{status.disk.path}</code>
            </div>
            <div className="rounded-xl border border-border bg-input/30 p-4">
              <div className="text-muted-foreground">Process RSS（プロセス常駐メモリ）</div>
              <div className="mt-1 font-mono">{formatBytes(status.memory.processRssBytes)}</div>
            </div>
            <div className="rounded-xl border border-border bg-input/30 p-4">
              <div className="text-muted-foreground">Heap（ヒープ）</div>
              <div className="mt-1 font-mono">
                {formatBytes(status.memory.processHeapUsedBytes)} /{" "}
                {formatBytes(status.memory.processHeapTotalBytes)}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
