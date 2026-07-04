"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "./useHydrated";

// localStorage と同期する状態フック。
// SSR ハイドレーション不整合を避けるため、初期値でレンダーしてからハイドレーション完了後に読み出す。
// effect 内 setState はカスケードレンダーを招くため、
// 「レンダー中に前回値と比較して調整する」React 推奨パターンで読み込む
export function useLocalStorage<T>(key: string, initialValue: T) {
  const hydrated = useHydrated();
  const [value, setValue] = useState<T>(initialValue);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  if (hydrated && loadedKey !== key) {
    setLoadedKey(key);
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // 破損した保存値は無視して初期値を使う
    }
  }

  useEffect(() => {
    // 保存値の読み込み完了前に初期値で上書きしない
    if (loadedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ストレージ書き込み失敗（容量超過など）は無視
    }
  }, [key, value, loadedKey]);

  return [value, setValue] as const;
}
