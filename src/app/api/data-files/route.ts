import { NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";

export async function GET() {
  const result = runBridgeCommandSync(["files"]);
  return NextResponse.json(result);
}
