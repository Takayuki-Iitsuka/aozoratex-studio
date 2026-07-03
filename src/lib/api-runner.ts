import { spawn, spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { safeValidateCompileRequest, type CompileRequest } from "./validation";

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

// Helper to run bridge command synchronously and return JSON payload
export function runBridgeCommandSync(args: string[]): any {
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
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to parse output: ${err.message}`,
      output: result.stdout,
    };
  }
}

// Interface for spawning generator
export interface SpawnedGenerator {
  process: ReturnType<typeof spawn>;
  stdout: any; // stream
}

export function spawnGenerator(args: string[]): SpawnedGenerator {
  const pythonExe = getPythonExecutable();
  const bridgeScript = path.join(process.cwd(), "src", "api_bridge.py");

  const proc = spawn(pythonExe, [bridgeScript, "generate", ...args], {
    windowsHide: true,
  });

  return {
    process: proc,
    stdout: proc.stdout,
  };
}

/**
 * Zod バリデーション付きのコンパイルリクエスト実行ヘルパー。
 * プロポーザルに従い、ブリッジ境界で型安全性を強化。
 */
export function spawnGeneratorValidated(payload: unknown): {
  ok: boolean;
  error?: any;
  generator?: SpawnedGenerator;
} {
  const validation = safeValidateCompileRequest(payload);
  if (!validation.success) {
    return { ok: false, error: validation.error };
  }
  // ここでは args 構築は呼び出し元に委ねるが、検証済みデータを返す形に拡張可能
  const generator = spawnGenerator([]); // プレースホルダ (実際は呼び出し元で構築)
  return { ok: true, generator };
}
