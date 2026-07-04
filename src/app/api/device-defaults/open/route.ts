import { NextRequest, NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";
import { z } from "zod";

// 開くアプリはサーバー側で許可した識別子のみ受け付ける（対象パスはサーバー側で固定）
const OpenPayloadSchema = z.object({
  app: z.enum(["default", "notepad", "vscode", "explorer"]),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  const parsed = OpenPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid open payload" },
      { status: 400 }
    );
  }
  const result = runBridgeCommandSync([
    "device-defaults-open",
    "--app",
    parsed.data.app,
  ]);
  return NextResponse.json(result);
}
