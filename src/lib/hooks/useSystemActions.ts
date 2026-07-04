"use client";

import { toast } from "sonner";

// システム保守操作（/settings ページ用）
export function useSystemActions() {
  const handleCleanup = async () => {
    try {
      const res = await fetch("/api/session/cleanup-nonpdf", { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success("中間ファイルを削除しました。");
    } catch (err) {
      console.error("Failed to run cleanup:", err);
      toast.error("クリーンアップに失敗しました。");
    }
  };

  const handleStopServer = async () => {
    if (!confirm("本当にこのアプリケーションサーバーをシャットダウンしますか？")) return;
    try {
      await fetch("/api/server/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      toast.warning("サーバーを停止しました。このタブを閉じてください。");
    } catch (err) {
      console.error("Stop server command failed:", err);
      toast.error("サーバー停止コマンドに失敗しました。");
    }
  };

  return { handleCleanup, handleStopServer };
}
