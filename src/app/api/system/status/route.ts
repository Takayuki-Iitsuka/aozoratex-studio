import fs from "node:fs/promises";
import os from "node:os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CpuSnapshot = {
  idle: number;
  total: number;
};

function takeCpuSnapshot(): CpuSnapshot {
  return os.cpus().reduce(
    (acc, cpu) => {
      const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
      acc.idle += cpu.times.idle;
      acc.total += total;
      return acc;
    },
    { idle: 0, total: 0 }
  );
}

function calculateCpuUsage(before: CpuSnapshot, after: CpuSnapshot): number {
  const idle = after.idle - before.idle;
  const total = after.total - before.total;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - idle / total) * 100));
}

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

async function getDiskUsage() {
  try {
    const stats = await fs.statfs(process.cwd());
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = Math.max(0, total - free);
    const percent = total > 0 ? (used / total) * 100 : 0;
    return {
      available: true,
      path: process.cwd(),
      totalBytes: total,
      usedBytes: used,
      freeBytes: free,
      usedPercent: round(percent),
    };
  } catch (err) {
    return {
      available: false,
      path: process.cwd(),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const cpuBefore = takeCpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 120));
  const cpuAfter = takeCpuSnapshot();

  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const processMemory = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    server: {
      status: "running",
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      uptimeSeconds,
      cwd: process.cwd(),
    },
    cpu: {
      model: os.cpus()[0]?.model ?? "unknown",
      cores: os.cpus().length,
      usagePercent: round(calculateCpuUsage(cpuBefore, cpuAfter)),
      loadAverage: os.loadavg().map((value) => round(value, 2)),
    },
    memory: {
      totalBytes: totalMemory,
      usedBytes: usedMemory,
      freeBytes: freeMemory,
      usedPercent: round((usedMemory / totalMemory) * 100),
      processRssBytes: processMemory.rss,
      processHeapUsedBytes: processMemory.heapUsed,
      processHeapTotalBytes: processMemory.heapTotal,
    },
    disk: await getDiskUsage(),
  });
}
