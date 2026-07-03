import { NextRequest, NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "light";
  const limit = searchParams.get("limit") || "0";
  const result = runBridgeCommandSync(["colors", "--mode", mode, "--limit", limit]);
  return NextResponse.json(result);
}
