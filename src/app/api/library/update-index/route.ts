import { NextResponse } from "next/server";
import { runBridgeCommand } from "@/lib/api-runner";

// インデックス取得はネットワーク処理で数秒〜十数秒かかるため非同期版を使う
export async function POST() {
  const result = await runBridgeCommand(["library-update-index"]);
  return NextResponse.json(result, { status: result.success ? 200 : 502 });
}
