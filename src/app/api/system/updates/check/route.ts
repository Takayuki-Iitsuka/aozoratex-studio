import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ---------- 型定義 ----------

type ToolCategory = "runtime" | "package-manager" | "typesetting";

type ToolVersionInfo = {
  name: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  updateCommand: string;
  category: ToolCategory;
};

type CheckResult = {
  success: true;
  checkedAt: string;
  tools: ToolVersionInfo[];
};

// ---------- ユーティリティ ----------

/** spawnSync の共通オプション */
const spawnOpts = {
  shell: process.platform === "win32",
  windowsHide: true,
  encoding: "utf-8" as const,
  timeout: 15000,
};

/** fetch の共通タイムアウトシグナル */
function fetchSignal(): AbortSignal {
  return AbortSignal.timeout(10000);
}

/** バージョン文字列を正規化（先頭の 'v' を除去、trim） */
function normalizeVersion(raw: string): string {
  return raw.trim().replace(/^v/i, "");
}

/**
 * 正規化済みバージョン文字列を比較し、current < latest なら true を返す。
 * セマンティックバージョニングのメジャー・マイナー・パッチを数値比較する。
 * パースに失敗した場合は単純な文字列比較にフォールバックする。
 */
function isUpdateAvailable(current: string, latest: string): boolean {
  if (!current || !latest || latest === "unknown") return false;

  const c = normalizeVersion(current);
  const l = normalizeVersion(latest);

  if (c === l) return false;

  const cParts = c.split(".").map(Number);
  const lParts = l.split(".").map(Number);

  // どちらかにNaNが含まれたら文字列比較にフォールバック
  if (cParts.some(isNaN) || lParts.some(isNaN)) {
    return c < l;
  }

  const maxLen = Math.max(cParts.length, lParts.length);
  for (let i = 0; i < maxLen; i++) {
    const cv = cParts[i] ?? 0;
    const lv = lParts[i] ?? 0;
    if (cv < lv) return true;
    if (cv > lv) return false;
  }

  return false;
}

/** コマンドを実行して stdout を返す。失敗時は null を返す。 */
function runCommand(command: string, args: string[]): string | null {
  try {
    const result = spawnSync(command, args, spawnOpts);
    if (result.error || result.status !== 0) return null;
    return result.stdout?.trim() ?? null;
  } catch {
    return null;
  }
}

/** 外部 JSON API を取得。失敗時は null を返す。 */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: fetchSignal() });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------- 各ツールのバージョンチェック ----------

/** Node.js: current = process.version, latest = nodejs.org LTS */
async function checkNodejs(): Promise<ToolVersionInfo> {
  const current = normalizeVersion(process.version);
  let latest = "unknown";

  type NodeRelease = { version: string; lts: string | false };
  const releases = await fetchJson<NodeRelease[]>(
    "https://nodejs.org/dist/index.json"
  );
  if (releases) {
    const ltsEntry = releases.find((r) => r.lts !== false);
    if (ltsEntry) {
      latest = normalizeVersion(ltsEntry.version);
    }
  }

  return {
    name: "Node.js",
    currentVersion: current,
    latestVersion: latest,
    updateAvailable: isUpdateAvailable(current, latest),
    updateCommand:
      "Download from https://nodejs.org/ or use nvm install --lts",
    category: "runtime",
  };
}

/** Python: current = python --version, latest = endoflife.date API */
async function checkPython(): Promise<ToolVersionInfo> {
  let current = "unknown";
  const raw = runCommand("python", ["--version"]);
  if (raw) {
    // "Python 3.12.1" → "3.12.1"
    const match = raw.match(/Python\s+([\d.]+)/i);
    if (match) current = match[1];
  }

  let latest = "unknown";
  type EolEntry = { latest: string };
  const data = await fetchJson<EolEntry[]>(
    "https://endoflife.date/api/python.json"
  );
  if (data && data.length > 0 && data[0].latest) {
    latest = normalizeVersion(data[0].latest);
  }

  return {
    name: "Python",
    currentVersion: current,
    latestVersion: latest,
    updateAvailable: isUpdateAvailable(current, latest),
    updateCommand: "Download from https://www.python.org/downloads/",
    category: "runtime",
  };
}

/** LaTeX (TeX Live): current = tlmgr --version (年を抽出), latest = endoflife.date API */
async function checkLatex(): Promise<ToolVersionInfo> {
  let current = "unknown";
  const raw = runCommand("tlmgr", ["--version"]);
  if (raw) {
    // "tlmgr revision 12345 (2024-01-01 ...)" や "TeX Live 2024" などから年を抽出
    const match = raw.match(/(\d{4})/);
    if (match) current = match[1];
  }

  let latest = "unknown";
  type EolEntry = { cycle: string; latest?: string };
  const data = await fetchJson<EolEntry[]>(
    "https://endoflife.date/api/tex-live.json"
  );
  if (data && data.length > 0) {
    // cycle フィールドが年を表す (例: "2024")
    latest = data[0].cycle ?? data[0].latest ?? "unknown";
  }

  return {
    name: "LaTeX (TeX Live)",
    currentVersion: current,
    latestVersion: latest,
    updateAvailable: isUpdateAvailable(current, latest),
    updateCommand: "tlmgr update --self --all",
    category: "typesetting",
  };
}

/** npm: current = npm --version, latest = npm view npm version */
async function checkNpm(): Promise<ToolVersionInfo> {
  const currentRaw = runCommand("npm", ["--version"]);
  const current = currentRaw ? normalizeVersion(currentRaw) : "unknown";

  const latestRaw = runCommand("npm", ["view", "npm", "version"]);
  const latest = latestRaw ? normalizeVersion(latestRaw) : "unknown";

  return {
    name: "npm",
    currentVersion: current,
    latestVersion: latest,
    updateAvailable: isUpdateAvailable(current, latest),
    updateCommand: "npm install -g npm@latest",
    category: "package-manager",
  };
}

/** pip: current = pip --version, latest = PyPI API */
async function checkPip(): Promise<ToolVersionInfo> {
  let current = "unknown";
  const raw = runCommand("pip", ["--version"]);
  if (raw) {
    // "pip 24.0 from ..." → "24.0"
    const match = raw.match(/pip\s+([\d.]+)/i);
    if (match) current = match[1];
  }

  let latest = "unknown";
  type PyPIResponse = { info: { version: string } };
  const data = await fetchJson<PyPIResponse>(
    "https://pypi.org/pypi/pip/json"
  );
  if (data?.info?.version) {
    latest = normalizeVersion(data.info.version);
  }

  return {
    name: "pip",
    currentVersion: current,
    latestVersion: latest,
    updateAvailable: isUpdateAvailable(current, latest),
    updateCommand: "python -m pip install --upgrade pip",
    category: "package-manager",
  };
}

// ---------- ハンドラ ----------

export async function GET() {
  // 全チェックを並行実行。個別に失敗しても他には影響しない。
  const results = await Promise.allSettled([
    checkNodejs(),
    checkPython(),
    checkLatex(),
    checkNpm(),
    checkPip(),
  ]);

  const tools: ToolVersionInfo[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;

    // 万が一 Promise がリジェクトされた場合のフォールバック
    const fallbackNames = [
      "Node.js",
      "Python",
      "LaTeX (TeX Live)",
      "npm",
      "pip",
    ];
    const fallbackCategories: ToolCategory[] = [
      "runtime",
      "runtime",
      "typesetting",
      "package-manager",
      "package-manager",
    ];
    return {
      name: fallbackNames[i],
      currentVersion: "unknown",
      latestVersion: "unknown",
      updateAvailable: false,
      updateCommand: "",
      category: fallbackCategories[i],
    };
  });

  const body: CheckResult = {
    success: true,
    checkedAt: new Date().toISOString(),
    tools,
  };

  return NextResponse.json(body);
}
