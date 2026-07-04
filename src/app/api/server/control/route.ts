import { spawn, spawnSync } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

function commandExists(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    cwd: process.cwd(),
    shell: process.platform === "win32",
    stdio: "ignore",
    windowsHide: true,
  });
  return result.status === 0;
}

function getDevCommand(): string {
  return commandExists("bun") ? "bun run dev" : "npm run dev";
}

function spawnRestartProcess() {
  const devCommand = getDevCommand();
  const restartCommand =
    process.platform === "win32"
      ? `timeout /t 2 /nobreak >nul & ${devCommand}`
      : `sleep 2; ${devCommand}`;

  const proc =
    process.platform === "win32"
      ? spawn("cmd", ["/c", restartCommand], {
          cwd: process.cwd(),
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        })
      : spawn("sh", ["-c", restartCommand], {
          cwd: process.cwd(),
          detached: true,
          stdio: "ignore",
        });

  proc.unref();
  return devCommand;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const action = data?.action;

    if (action === "status") {
      return NextResponse.json({
        success: true,
        status: "running",
        pid: process.pid,
        uptimeSeconds: Math.floor(process.uptime()),
      });
    }

    if (action === "start") {
      return NextResponse.json({
        success: true,
        status: "running",
        message: "AozoraTeX Studio Serverは既に起動しています。",
      });
    }

    if (action === "stop") {
      setTimeout(() => {
        process.exit(0);
      }, 500);
      return NextResponse.json({ success: true, message: "AozoraTeX Studio Serverを停止します。" });
    }

    if (action === "restart") {
      const devCommand = spawnRestartProcess();
      setTimeout(() => {
        process.exit(0);
      }, 500);
      return NextResponse.json({
        success: true,
        message: `AozoraTeX Studio Serverを再起動します。起動コマンド: ${devCommand}`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unsupported action. Action must be 'status', 'start', 'stop', or 'restart'.",
      },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
