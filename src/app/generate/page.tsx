"use client";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  FileText,
  Laptop,
  Play,
  Layers,
  ExternalLink,
  AlertTriangle,
  Settings2,
  Eye,
} from "lucide-react";

import { useSettings } from "@/lib/contexts/SettingsContext";
import { useDataFiles } from "@/lib/hooks/useDataFiles";
import { useCompile } from "@/lib/hooks/useCompile";
import { Terminal } from "@/components/Terminal";
import { DevicePreview } from "@/components/DevicePreview";
import { StepCard } from "@/components/StepCard";
import { FileSelector } from "@/components/FileSelector";
import { PREVIEW_SAMPLE_TEXT } from "@/lib/preview-sample";

export default function GeneratePage() {
  const settings = useSettings();
  const dataFiles = useDataFiles();
  const compile = useCompile();

  // 現在の設定 state を使ってコンパイルを実行する
  const triggerCompile = (allFilesMode: boolean = false) => {
    compile.handleCompile(
      allFilesMode ? dataFiles.files.map((f) => f.path) : dataFiles.selectedFiles,
      settings.selectedDevice,
      settings.bgColor,
      settings.fgColor,
      settings.selectedFont,
      {
        mainWashiEnabled: settings.mainWashiEnabled,
        mainFrameEnabled: settings.mainFrameEnabled,
        mainFrameVariant: parseInt(settings.mainFrameVariant),
        coverTextureEnabled: settings.coverTextureEnabled,
        coverTextureVariant: parseInt(settings.coverTextureVariant),
        backgroundRenderMode: settings.backgroundRenderMode,
        coverImagePath: settings.coverImagePath,
        washiImagePath: settings.washiImagePath,
        coverImageOpacity: settings.coverImageOpacity,
        washiImageOpacity: settings.washiImageOpacity,
        pageNumberEnabled: settings.pageNumberEnabled,
        bodyColumnMode: settings.bodyColumnMode,
        deviceOrientation: settings.deviceOrientation,
      }
    );
  };

  const activeDevice = settings.devices[settings.selectedDevice];
  const widthMm = activeDevice?.base_width || activeDevice?.width_mm || 100;
  const heightMm = activeDevice?.base_height || activeDevice?.height_mm || 100;
  const devicesByCategory = {
    smartphone: Object.entries(settings.devices).filter(([, device]) => device.category === "smartphone"),
    tablet: Object.entries(settings.devices).filter(([, device]) => device.category === "tablet"),
    pc: Object.entries(settings.devices).filter(([, device]) => device.category === "pc"),
  };
  const deviceEntries = [
    ...devicesByCategory.smartphone,
    ...devicesByCategory.tablet,
    ...devicesByCategory.pc,
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">PDF生成</h1>
        <p className="text-sm text-muted-foreground">
          入力ファイルと出力デバイスを選択し、縦書き PDF を生成します。
        </p>
      </div>

      {/* Global Progress Bar */}
      <section className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            変換プロセス
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-foreground/90">
            {compile.progressLabel}
          </span>
        </div>
        <div className="w-full bg-muted h-3 rounded-full overflow-hidden p-[2px]">
          <motion.div
            className="h-full bg-linear-to-r from-purple-500 to-indigo-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${compile.progress}%` }}
            transition={{ ease: "easeInOut" }}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Main Controls Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Source Files list */}
          <StepCard
            stepLabel="Step 1"
            title="入力ファイル選択"
            description="単体選択と複数選択の両方に対応しています。"
            icon={<FileText size={18} />}
            headerAction={
              <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold">
                {dataFiles.selectedFiles.length} 件選択
              </span>
            }
          >
            <FileSelector
              files={dataFiles.files}
              filteredAndSortedFiles={dataFiles.filteredAndSortedFiles}
              selectedFiles={dataFiles.selectedFiles}
              searchQuery={dataFiles.searchQuery}
              sortBy={dataFiles.sortBy}
              onSearchChange={dataFiles.setSearchQuery}
              onSortChange={dataFiles.setSortBy}
              onToggle={dataFiles.toggleFile}
              onSelectAll={dataFiles.selectAllFiles}
              onClearAll={dataFiles.clearAllFiles}
            />
            <p className="text-xs text-muted-foreground">
              ファイルが見つからない場合は{" "}
              <Link href="/library" className="text-accent hover:underline">
                書籍検索
              </Link>{" "}
              から青空文庫の作品をダウンロードできます。
            </p>
          </StepCard>

          {/* Step 2: Output Device sizes */}
          <StepCard
            stepLabel="Step 2"
            title="出力デバイスサイズ選択"
            description="端末ごとの仕上がり寸法を確認しながら選べます。"
            icon={<Laptop size={18} />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {deviceEntries.map(([devKey, dev]) => {
                const isSelected = settings.selectedDevice === devKey;
                return (
                  <div
                    key={devKey}
                    onClick={() => settings.setSelectedDevice(devKey)}
                    className={`rounded-2xl p-5 border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? "bg-accent/5 border-accent shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                        : "bg-input/40 border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider ${
                            isSelected ? "text-accent" : "text-muted-foreground"
                          }`}
                        >
                          {devKey}
                        </span>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-accent" />}
                      </div>
                      <h3 className="text-sm font-bold text-foreground capitalize">
                        {dev.label || devKey}
                      </h3>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/60 text-xs text-muted-foreground space-y-1">
                      <div>
                        寸法: {dev.width_mm} x {dev.height_mm} mm
                      </div>
                      <div>標準文字サイズ: {dev.font_size} pt</div>
                      <div>
                        {dev.category === "smartphone"
                          ? "縦向き / 一段組固定"
                          : dev.supports_orientation
                            ? "縦横・一段/二段対応"
                            : "A4 / 一段・二段対応"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show display orientation for responsive devices */}
            {activeDevice?.supports_orientation && (
              <div className="pt-2">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 block">
                  表示方向
                </label>
                <div className="grid grid-cols-2 gap-2 bg-input/60 p-1 border border-border rounded-xl">
                  <button
                    onClick={() => settings.setDeviceOrientation("portrait")}
                    className={`py-2 text-xs font-medium rounded-lg transition ${
                      settings.deviceOrientation === "portrait"
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Portrait（縦向き）
                  </button>
                  <button
                    onClick={() => settings.setDeviceOrientation("landscape")}
                    className={`py-2 text-xs font-medium rounded-lg transition ${
                      settings.deviceOrientation === "landscape"
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Landscape（横向き）
                  </button>
                </div>
              </div>
            )}
          </StepCard>

          {/* 現在のスタイル設定サマリー（変更は設定ページで） */}
          <StepCard
            stepLabel="Step 3"
            title="スタイル設定の確認"
            description="配色・フォント・装飾は設定ページで変更できます。"
            icon={<Settings2 size={18} />}
            headerAction={
              <Link
                href="/settings"
                className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 text-foreground border border-border font-semibold transition"
              >
                設定を変更する
              </Link>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
                <div className="text-muted-foreground">配色</div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded border border-border inline-block"
                    style={{ backgroundColor: settings.bgColor }}
                  />
                  <span
                    className="w-4 h-4 rounded border border-border inline-block"
                    style={{ backgroundColor: settings.fgColor }}
                  />
                  <span className="font-mono text-foreground/90">
                    {settings.bgColor} / {settings.fgColor}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
                <div className="text-muted-foreground">フォント</div>
                <div className="font-semibold text-foreground/90 truncate">
                  {settings.selectedFont || "未読み込み"}
                </div>
                <div className="text-muted-foreground">{settings.fontSize} pt</div>
              </div>
              <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
                <div className="text-muted-foreground">装飾</div>
                <div className="text-foreground/90">
                  {[
                    settings.mainWashiEnabled && "和紙背景",
                    settings.mainFrameEnabled && "外枠フレーム",
                    settings.coverTextureEnabled && "表紙テクスチャ",
                  ]
                    .filter(Boolean)
                    .join(" / ") || "なし"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1.5">
                <div className="text-muted-foreground">段組 / ノンブル</div>
                <div className="text-foreground/90">
                  {settings.bodyColumnMode === "two_column" ? "二段組" : "一段組"} /{" "}
                  {settings.pageNumberEnabled ? "あり" : "なし"}
                </div>
              </div>
            </div>
          </StepCard>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          <Link
            href="/preview"
            className="w-full px-4 py-3 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition inline-flex items-center justify-center gap-2"
          >
            <Eye size={14} />
            出力確認プレビューを開く
          </Link>

          {/* Aspect ratio preview and text wrap checks */}
          <DevicePreview
            deviceKey={settings.selectedDevice}
            deviceLabel={activeDevice?.label}
            widthMm={widthMm}
            heightMm={heightMm}
            baseWidthMm={activeDevice?.width_mm}
            baseHeightMm={activeDevice?.height_mm}
            screenWidthPx={activeDevice?.width}
            screenHeightPx={activeDevice?.height}
            orientation={settings.deviceOrientation}
            bgColor={settings.bgColor}
            fgColor={settings.fgColor}
            selectedFont={settings.selectedFont}
            fontSize={settings.fontSize}
            sampleText={PREVIEW_SAMPLE_TEXT}
          />

          {/* Execution Console */}
          <StepCard
            stepLabel="Step 4"
            title="生成コンソール"
            description="現在の選択設定で PDF を生成します。"
          >
            <div className="space-y-3">
              <button
                onClick={() => triggerCompile(false)}
                disabled={compile.isCompiling || dataFiles.selectedFiles.length === 0}
                className="w-full py-4 text-sm font-bold bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Play size={16} fill="currentColor" />
                選択ファイルをPDF化
              </button>

              <button
                onClick={() => triggerCompile(true)}
                disabled={compile.isCompiling || dataFiles.files.length === 0}
                className="w-full py-3.5 text-sm font-semibold bg-muted hover:bg-muted/70 disabled:opacity-50 text-foreground border border-border rounded-xl transition flex items-center justify-center gap-2"
              >
                <Layers size={15} />
                data全件をPDF化
              </button>
            </div>

            {/* Action output alerts */}
            {compile.resultAlert && (
              <div
                className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  compile.resultAlert.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300"
                }`}
              >
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span className="font-medium">{compile.resultAlert.message}</span>
                </div>
                {compile.resultAlert.success && compile.resultAlert.pdfUrl && (
                  <a
                    href={compile.resultAlert.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition inline-flex items-center gap-1"
                  >
                    PDFをブラウザで開く <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </StepCard>

          {/* Logging terminal */}
          <Terminal
            logs={compile.compileLogs}
            visible={compile.isCompiling || compile.compileLogs.length > 0}
          />
        </div>
      </div>
    </div>
  );
}
