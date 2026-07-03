import { NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";

export async function GET() {
  const result = runBridgeCommandSync(["devices"]);
  return NextResponse.json(result);
}
