"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useHydrated } from "@/lib/hooks/useHydrated";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // SSR とクライアントでテーマが一致しないため、ハイドレーション完了後にのみアイコンを描画する
  const mounted = useHydrated();

  const isDark = resolvedTheme === "dark";
  const toggleLabel = mounted ? (isDark ? "ライトモードに切り替え" : "ダークモードに切り替え") : "テーマを切り替え";

  return (
    <button
      type="button"
      onClick={() => setTheme(mounted && isDark ? "light" : "dark")}
      aria-label={toggleLabel}
      title={toggleLabel}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
    >
      {mounted ? isDark ? <Sun size={16} /> : <Moon size={16} /> : <Sun size={16} className="opacity-0" />}
    </button>
  );
}
