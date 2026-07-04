import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** コマンド実行のタイムアウト（ミリ秒） */
const EXECUTION_TIMEOUT_MS = 120_000;

/** アップデートコマンドの種別 */
type UpdateType = "npm" | "pip" | "tlmgr" | "system";

interface ExecuteRequest {
  command: string;
  type: UpdateType;
}

interface ExecuteResponse {
  success: boolean;
  command: string;
  output: string;
  exitCode: number | null;
  durationMs: number;
}

/**
 * コマンドが許可されたパターンに一致するかを検証する。
 * セキュリティ上、ホワイトリスト方式で厳密に制御する。
 */
function isCommandAllowed(command: string, type: UpdateType): boolean {
  const trimmed = command.trim();

  switch (type) {
    case "npm":
      return (
        trimmed.startsWith("npm update") ||
        trimmed.startsWith("npm install -g npm@") ||
        trimmed.startsWith("npm install")
      );
    case "pip":
      return (
        trimmed.startsWith("pip install --upgrade") ||
        trimmed.startsWith("python -m pip install --upgrade")
      );
    case "tlmgr":
      return trimmed.startsWith("tlmgr update");
    case "system":
      return false; // system カテゴリは現在すべて拒否
    default:
      return false;
  }
}

/**
 * コマンドを非同期で実行し、stdout/stderr を結合して返す。
 * タイムアウト時はプロセスを強制終了する。
 */
function executeCommand(command: string): Promise<{ output: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const args = isWindows ? ["/c", command] : ["-c", command];
    const cmd = isWindows ? "cmd" : "/bin/sh";

    const chunks: string[] = [];
    let settled = false;

    const proc = spawn(cmd, args, {
      cwd: process.cwd(),
      shell: false, // cmd/sh を直接起動するため shell は不要
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        // タイムアウト: プロセスツリーごと終了
        try {
          proc.kill("SIGKILL");
        } catch {
          // プロセスが既に終了している場合は無視
        }
        chunks.push(`\n[タイムアウト] ${EXECUTION_TIMEOUT_MS / 1000}秒を超過したため、プロセスを終了しました。\n`);
        resolve({ output: chunks.join(""), exitCode: null });
      }
    }, EXECUTION_TIMEOUT_MS);

    proc.stdout?.on("data", (data: Buffer) => {
      chunks.push(data.toString());
    });

    proc.stderr?.on("data", (data: Buffer) => {
      chunks.push(data.toString());
    });

    proc.on("error", (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        chunks.push(`\n[エラー] プロセス起動失敗: ${err.message}\n`);
        resolve({ output: chunks.join(""), exitCode: null });
      }
    });

    proc.on("close", (code: number | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve({ output: chunks.join(""), exitCode: code });
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    let body: ExecuteRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "リクエストボディのJSON解析に失敗しました。" },
        { status: 400 }
      );
    }

    const { command, type } = body;

    // バリデーション: 必須フィールド
    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { success: false, error: "command フィールドは必須です（文字列）。" },
        { status: 400 }
      );
    }

    const validTypes: UpdateType[] = ["npm", "pip", "tlmgr", "system"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `type フィールドは ${validTypes.join(", ")} のいずれかを指定してください。` },
        { status: 400 }
      );
    }

    // セキュリティ: ホワイトリスト検証
    if (!isCommandAllowed(command, type)) {
      return NextResponse.json(
        {
          success: false,
          error: `許可されていないコマンドです。type="${type}" に対して実行可能なコマンドパターンに一致しません。`,
          command,
        },
        { status: 403 }
      );
    }

    // コマンド実行
    const startTime = performance.now();
    const { output, exitCode } = await executeCommand(command);
    const durationMs = Math.round(performance.now() - startTime);

    const response: ExecuteResponse = {
      success: exitCode === 0,
      command,
      output,
      exitCode,
      durationMs,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `予期しないエラーが発生しました: ${message}` },
      { status: 500 }
    );
  }
}
