import { NextRequest, NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";
import { z } from "zod";

// 端末キー → { 設定キー: 値 } の2段ネスト。値の検証は settings_store 側に委ねる
const DeviceDefaultsPayloadSchema = z.record(
  z.string(),
  z.record(z.string(), z.any())
);

export async function GET() {
  const result = runBridgeCommandSync(["device-defaults-get"]);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  const parsed = DeviceDefaultsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid device defaults payload" },
      { status: 400 }
    );
  }
  const result = runBridgeCommandSync([
    "device-defaults-save",
    "--data",
    JSON.stringify(parsed.data),
  ]);
  return NextResponse.json(result);
}
