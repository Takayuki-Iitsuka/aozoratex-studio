import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const action = data?.action;

    if (action === "stop") {
      setTimeout(() => {
        process.exit(0);
      }, 500);
      return NextResponse.json({ success: true, message: "AozoraTeX Studio Serverを停止します。" });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported action. Action must be 'stop'." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
