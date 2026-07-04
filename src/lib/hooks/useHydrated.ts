"use client";

import { useSyncExternalStore } from "react";

// 何も購読しない（ハイドレーション完了の検出のみに使う）
const emptySubscribe = () => () => {};

// SSR・ハイドレーション中は false、クライアントでのハイドレーション完了後は true を返す。
// effect 内 setState によるマウント検出（カスケードレンダーの原因）の代替手段
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
