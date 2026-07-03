import { NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";

export async function POST() {
  const result = runBridgeCommandSync(["settings-reset"]);
  return NextResponse.json(result);
}
