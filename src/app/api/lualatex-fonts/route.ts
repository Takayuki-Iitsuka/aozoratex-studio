import { NextRequest, NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "true";
  const args = ["fonts"];
  if (refresh) {
    args.push("--refresh");
  }
  const result = runBridgeCommandSync(args);
  return NextResponse.json(result);
}
