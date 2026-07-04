import { spawn, spawnSync } from "child_process";
import type { Readable } from "stream";
import path from "path";
import fs from "fs";

// Resolve Python executable path
export function getPythonExecutable(): string {
  const isWindows = process.platform === "win32";
  const venvPath = isWindows
    ? path.join(process.cwd(), ".venv", "Scripts", "python.exe")
    : path.join(process.cwd(), ".venv", "bin", "python");

  if (fs.existsSync(venvPath)) {
    return venvPath;
  }
  return isWindows ? "python" : "python3";
}

// ブリッジの応答 JSON（success 以外のフィールドはコマンドごとに異なる）
export interface BridgeResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

// Helper to run bridge command synchronously and return JSON payload
export function runBridgeCommandSync(args: string[]): BridgeResult {
  const pythonExe = getPythonExecutable();
  const bridgeScript = path.join(process.cwd(), "src", "api_bridge.py");

  const result = spawnSync(pythonExe, [bridgeScript, ...args], {
    encoding: "utf-8",
    windowsHide: true,
  });

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  if (result.status !== 0) {
    return {
      success: false,
      error: `Bridge process exited with code ${result.status}`,
      stderr: result.stderr,
    };
  }

  try {
    return JSON.parse(result.stdout.trim());
  } catch (err) {
    return {
      success: false,
      error: `Failed to parse output: ${err instanceof Error ? err.message : String(err)}`,
      output: result.stdout,
    };
  }
}

// 非同期版ブリッジ実行。ネットワーク取得などの長い処理を spawnSync で
// 実行するとイベントループ全体が止まるため、こちらを使う。
export function runBridgeCommand(args: string[]): Promise<BridgeResult> {
  const pythonExe = getPythonExecutable();
  const bridgeScript = path.join(process.cwd(), "src", "api_bridge.py");

  return new Promise((resolve) => {
    const proc = spawn(pythonExe, [bridgeScript, ...args], {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    proc.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    proc.on("close", (code) => {
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch (err) {
        resolve({
          success: false,
          error:
            code !== 0
              ? `Bridge process exited with code ${code}`
              : `Failed to parse output: ${err instanceof Error ? err.message : String(err)}`,
          stderr,
          output: stdout,
        });
      }
    });
  });
}

// Interface for spawning generator
export interface SpawnedGenerator {
  process: ReturnType<typeof spawn>;
  stdout: Readable;
}

// LOG:/RESULT: プレフィクス行をストリーミングするサブコマンド用の汎用 spawn
export function spawnBridge(args: string[]): SpawnedGenerator {
  const pythonExe = getPythonExecutable();
  const bridgeScript = path.join(process.cwd(), "src", "api_bridge.py");

  const proc = spawn(pythonExe, [bridgeScript, ...args], {
    windowsHide: true,
  });

  return {
    process: proc,
    stdout: proc.stdout,
  };
}

export function spawnGenerator(args: string[]): SpawnedGenerator {
  return spawnBridge(["generate", ...args]);
}
