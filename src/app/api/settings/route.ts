import { NextRequest, NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";
import { z } from "zod";

// 簡易設定スキーマ例 (完全版はsettings_storeに委ね)
// zod 4 では z.record はキー・値の2引数が必須
const SettingsPayloadSchema = z.record(z.string(), z.any());

export async function GET() {
  const result = runBridgeCommandSync(["settings-get"]);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = SettingsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid settings payload" },
      { status: 400 }
    );
  }
  const result = runBridgeCommandSync(["settings-save", "--data", JSON.stringify(parsed.data)]);
  return NextResponse.json(result);
}
