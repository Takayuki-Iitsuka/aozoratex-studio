import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// --- 型定義 ---

type OutdatedPackage = {
  name: string;
  currentVersion: string;
  wantedVersion: string;
  latestVersion: string;
  packageManager: "npm" | "pip";
  updateCommand: string;
};

type CheckResult = {
  packages: OutdatedPackage[];
  error?: string;
};

// npm outdated --json の各エントリ
type NpmOutdatedEntry = {
  current?: string;
  wanted?: string;
  latest?: string;
  type?: string;
};

// pip list --outdated --format=json の各エントリ
type PipOutdatedEntry = {
  name?: string;
  version?: string;
  latest_version?: string;
  latest_filetype?: string;
};

// --- spawnSync 共通オプション ---

const spawnOptions = {
  cwd: process.cwd(),
  shell: process.platform === "win32",
  windowsHide: true,
  encoding: "utf-8" as const,
  timeout: 30000,
};

// --- npm outdated チェック ---

function checkNpmOutdated(): CheckResult {
  try {
    const result = spawnSync("npm", ["outdated", "--json"], spawnOptions);

    // npm outdated --json は古いパッケージがある場合 exit code 1 を返す（正常動作）
    // stdout が空の場合は古いパッケージなし
    const stdout = (result.stdout ?? "").trim();

    if (!stdout) {
      return { packages: [] };
    }

    // stderr にエラーがあり、stdout が空または無効な JSON の場合のみエラーとする
    let parsed: Record<string, NpmOutdatedEntry>;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      // JSON パースに失敗した場合
      const stderr = (result.stderr ?? "").trim();
      return {
        packages: [],
        error: `npm outdated の出力をパースできませんでした: ${stderr || "不明なエラー"}`,
      };
    }

    const packages: OutdatedPackage[] = Object.entries(parsed)
      .filter(
        ([, entry]) =>
          entry &&
          typeof entry === "object" &&
          (entry.current || entry.wanted || entry.latest)
      )
      .map(([name, entry]) => ({
        name,
        currentVersion: entry.current ?? "unknown",
        wantedVersion: entry.wanted ?? entry.latest ?? "unknown",
        latestVersion: entry.latest ?? entry.wanted ?? "unknown",
        packageManager: "npm" as const,
        updateCommand: `npm update ${name}`,
      }));

    return { packages };
  } catch (err) {
    return {
      packages: [],
      error: `npm チェックに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// --- pip outdated チェック ---

function checkPipOutdated(): CheckResult {
  try {
    const result = spawnSync(
      "pip",
      ["list", "--outdated", "--format=json"],
      spawnOptions
    );

    const stdout = (result.stdout ?? "").trim();

    if (!stdout) {
      // pip が見つからない、または古いパッケージなし
      if (result.error) {
        return {
          packages: [],
          error: `pip コマンドを実行できませんでした: ${result.error.message}`,
        };
      }
      return { packages: [] };
    }

    let parsed: PipOutdatedEntry[];
    try {
      parsed = JSON.parse(stdout);
    } catch {
      const stderr = (result.stderr ?? "").trim();
      return {
        packages: [],
        error: `pip outdated の出力をパースできませんでした: ${stderr || "不明なエラー"}`,
      };
    }

    if (!Array.isArray(parsed)) {
      return {
        packages: [],
        error: "pip の出力が期待される配列形式ではありませんでした",
      };
    }

    const packages: OutdatedPackage[] = parsed
      .filter(
        (entry) =>
          entry && typeof entry === "object" && entry.name && entry.version
      )
      .map((entry) => {
        const latestVersion = entry.latest_version ?? entry.version ?? "unknown";
        return {
          name: entry.name!,
          currentVersion: entry.version!,
          wantedVersion: latestVersion,
          latestVersion,
          packageManager: "pip" as const,
          updateCommand: `pip install --upgrade ${entry.name}`,
        };
      });

    return { packages };
  } catch (err) {
    return {
      packages: [],
      error: `pip チェックに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// --- GET ハンドラー ---

export async function GET() {
  // 両方のチェックを並行して実行
  // spawnSync は同期だが、Promise.all でラップすることで
  // 一方が失敗しても他方の結果を返せる
  const [npmResult, pipResult] = await Promise.all([
    Promise.resolve().then(() => checkNpmOutdated()),
    Promise.resolve().then(() => checkPipOutdated()),
  ]);

  const errors: string[] = [];
  if (npmResult.error) errors.push(npmResult.error);
  if (pipResult.error) errors.push(pipResult.error);

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    npm: npmResult.packages,
    pip: pipResult.packages,
    totalOutdated: npmResult.packages.length + pipResult.packages.length,
    ...(errors.length > 0 && { errors }),
  });
}
