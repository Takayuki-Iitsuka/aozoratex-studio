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
    <section className="rounded-2xl border border-white/5 bg-zinc-900/60 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TerminalIcon size={16} /> コンパイル・ログ
          </h2>
          <p className="text-xs text-zinc-400">リアルタイムのコンパイル進捗状況です。</p>
        </div>
      </div>

      <div className="h-64 rounded-xl bg-zinc-950 border border-white/5 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
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
