import { NextRequest, NextResponse } from "next/server";
import { runBridgeCommandSync } from "@/lib/api-runner";
import { safeValidateLibrarySearchQuery } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const validation = safeValidateLibrarySearchQuery({
    q: params.get("q") ?? undefined,
    offset: params.get("offset") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: validation.error },
      { status: 400 }
    );
  }

  const { q, offset, limit } = validation.data;
  const result = runBridgeCommandSync([
    "library-search",
    "--query",
    q,
    "--offset",
    String(offset),
    "--limit",
    String(limit),
  ]);
  return NextResponse.json(result);
}
