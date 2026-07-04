"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileOutput,
  Settings,
  ArrowRight,
  ExternalLink,
  FileText,
  DatabaseZap,
  Laptop,
  Type,
} from "lucide-react";

import { useSettings } from "@/lib/contexts/SettingsContext";

// ホーム＝機能へのハブ。実作業は各機能ページ（/library, /generate, /settings）で行う
const FEATURES = [
  {
    href: "/library",
    step: "Step 1",
    title: "書籍検索",
    description: "青空文庫から作品・著者を検索し、入力ファイルとしてダウンロードします。",
    icon: Search,
  },
  {
    href: "/generate",
    step: "Step 2",
    title: "PDF生成",
    description: "入力ファイルと出力デバイスを選択し、縦書き PDF を生成します。",
    icon: FileOutput,
  },
  {
    href: "/settings",
    step: "Step 3",
    title: "設定",
    description: "配色・フォント・装飾・段組などの組版設定を調整して保存します。",
    icon: Settings,
  },
];

const DOC_LINKS = [
  { href: "/static/docs/index.html", label: "マニュアル" },
  { href: "/static/docs/manuals/colors-visualizer.html", label: "カラーパレット一覧" },
  { href: "/static/docs/manuals/font-selection.html", label: "フォント選定ガイド" },
];

export default function HomePage() {
  const settings = useSettings();
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [indexStatus, setIndexStatus] = useState<{ cached: boolean; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/data-files")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setFileCount(json.files.length);
      })
      .catch(() => setFileCount(null));

    fetch("/api/library/status")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setIndexStatus({ cached: json.cached, total: json.total });
      })
      .catch(() => setIndexStatus(null));
  }, []);

  return (
    <div className="space-y-6">
      {/* ヒーロー */}
      <header className="rounded-2xl border border-border bg-card/60 p-8 sm:p-10 space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 text-xs rounded-full font-medium bg-muted border border-border text-muted-foreground">
            Next.js + Bun
          </span>
          <span className="px-3 py-1 text-xs rounded-full font-medium bg-accent/10 border border-accent/20 text-accent">
            LuaLaTeX Engine
          </span>
          <span className="px-3 py-1 text-xs rounded-full font-medium bg-muted border border-border text-muted-foreground">
            jlreq 縦書き組版
          </span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          AozoraTeX <span className="text-accent">Studio</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          青空文庫の作品を検索・ダウンロードし、デバイスサイズ、配色、フォント、装飾をカスタマイズして高品質な縦書き
          PDF を生成する組版スタジオ。
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 pt-1">
          {DOC_LINKS.map((doc, i) => (
            <React.Fragment key={doc.href}>
              {i > 0 && <span className="text-border select-none">|</span>}
              <a
                href={doc.href}
                target="_blank"
                rel="opener"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline transition"
              >
                {doc.label} <ExternalLink size={12} />
              </a>
            </React.Fragment>
          ))}
        </div>
      </header>

      {/* 機能メニュー */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FEATURES.map(({ href, step, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-border bg-card/60 p-6 flex flex-col gap-3 transition hover:border-accent hover:bg-accent/5"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20">
                <Icon size={20} />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {step}
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
              開く{" "}
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {/* 現在の状態サマリー */}
      <section className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          現在の状態
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText size={13} /> 入力ファイル
            </div>
            <div className="text-base font-bold text-foreground">
              {fileCount === null ? "—" : `${fileCount} 件`}
            </div>
            <Link href="/library" className="text-accent hover:underline">
              書籍を追加する
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DatabaseZap size={13} /> 作品インデックス
            </div>
            <div className="text-base font-bold text-foreground">
              {indexStatus === null
                ? "—"
                : indexStatus.cached
                  ? `${indexStatus.total.toLocaleString()} 作品`
                  : "未取得"}
            </div>
            <Link href="/library" className="text-accent hover:underline">
              {indexStatus?.cached ? "検索する" : "取得する"}
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Laptop size={13} /> 出力デバイス
            </div>
            <div className="text-base font-bold text-foreground capitalize">
              {settings.selectedDevice}
            </div>
            <div className="text-muted-foreground">
              {settings.devices[settings.selectedDevice]
                ? `${settings.devices[settings.selectedDevice].width_mm} × ${settings.devices[settings.selectedDevice].height_mm} mm`
                : "読み込み中..."}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Type size={13} /> 組版スタイル
            </div>
            <div className="text-base font-bold text-foreground truncate">
              {settings.selectedFont || "未読み込み"}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="w-3 h-3 rounded border border-border inline-block"
                style={{ backgroundColor: settings.bgColor }}
              />
              <span
                className="w-3 h-3 rounded border border-border inline-block"
                style={{ backgroundColor: settings.fgColor }}
              />
              <span className="font-mono">
                {settings.bgColor} / {settings.fgColor}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
