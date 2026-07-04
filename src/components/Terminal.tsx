import React, { useRef, useEffect } from "react";
import { Terminal as TerminalIcon } from "lucide-react";
import { LogEntry } from "@/lib/hooks/useCompile";

interface TerminalProps {
  logs: LogEntry[];
  visible: boolean;
}

export function Terminal({ logs, visible }: TerminalProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  if (!visible) return null;

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <TerminalIcon size={16} /> コンパイル・ログ
          </h2>
          <p className="text-xs text-muted-foreground">リアルタイムのコンパイル進捗状況です。</p>
        </div>
      </div>

      {/* ログはテーマに関わらずダーク端末風の配色で表示する */}
      <div className="h-64 rounded-xl bg-zinc-950 border border-border p-4 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={
              log.type === "stderr"
                ? "text-rose-400"
                : log.type === "error"
                  ? "text-red-500 font-bold"
                  : "text-emerald-400/90"
            }
          >
            {log.content}
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>
    </section>
  );
}
