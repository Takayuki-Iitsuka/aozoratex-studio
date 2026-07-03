"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Laptop,
  Sliders,
  Palette,
  Type,
  Play,
  Trash2,
  RotateCcw,
  Power,
  RefreshCw,
  Layers,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

import { useAozoraData } from "@/lib/hooks/useAozoraData";
import { useCompile } from "@/lib/hooks/useCompile";
import { Terminal } from "@/components/Terminal";
import { DevicePreview } from "@/components/DevicePreview";
import { StepCard } from "@/components/StepCard";
import { FileSelector } from "@/components/FileSelector";

const SIZE_REFERENCE_SAMPLE = `\\section*{LuaLaTeX 日本語環境・完全文字化けテスト}

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\\section*{1. CJK 拡張漢字（Ext-A〜F）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

𠮷 𠯁 𠯃 𠯄 𠯅 𠯆 𠯇 𠯈 𠯉 𠯊
𡈽 𡉀 𡉁 𡉂 𡉂 𡉄 𡉅 𡉆 𡉇 𡉈

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\\section*{2. 互換漢字（CJK Compatibility Ideographs）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

﨑 神 祥 福 靖 精 羽 﨟 蘒 﨡

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
\\section*{3. 異体字セレクタ（IVS）}
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

辻\u{E0100} 辻\u{E0101} 辻\u{E0102}
葛\u{E0100} 葛\u{E0101} 葛\u{E0102}
髙\u{E0100} 髙\u{E0101} 髙\u{E0102}`;

export default function AozoraStudio() {
  const data = useAozoraData();
  const compile = useCompile();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Trigger compilation using active settings states
  const triggerCompile = (allFilesMode: boolean = false) => {
    compile.handleCompile(
      allFilesMode ? data.files.map((f) => f.path) : data.selectedFiles,
      data.selectedDevice,
      data.bgColor,
      data.fgColor,
      data.selectedFont,
      {
        mainWashiEnabled: data.mainWashiEnabled,
        mainFrameEnabled: data.mainFrameEnabled,
        mainFrameVariant: parseInt(data.mainFrameVariant),
        coverTextureEnabled: data.coverTextureEnabled,
        coverTextureVariant: parseInt(data.coverTextureVariant),
        backgroundRenderMode: data.backgroundRenderMode,
        coverImagePath: data.coverImagePath,
        washiImagePath: data.washiImagePath,
        coverImageOpacity: data.coverImageOpacity,
        washiImageOpacity: data.washiImageOpacity,
        pageNumberEnabled: data.pageNumberEnabled,
        bodyColumnMode: data.bodyColumnMode,
        deviceOrientation: data.deviceOrientation,
      }
    );
  };

  // Dimensions helper mapping
  const activeDevice = data.devices[data.selectedDevice];
  const widthMm = activeDevice?.width_mm || 100;
  const heightMm = activeDevice?.height_mm || 100;

  return (
    <div className="bg-[#09090b] text-[#f4f4f5] min-h-screen py-8 px-4 sm:px-6 lg:px-8 selection:bg-purple-500/30">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[128px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-8 relative">
        {/* Header Hero Section */}
        <header className="relative rounded-3xl overflow-hidden border border-white/5 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 p-8 sm:p-10 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 text-xs rounded-full font-medium bg-zinc-800 border border-zinc-700/50 text-zinc-300">
                  Next.js 15 App
                </span>
                <span className="px-3 py-1 text-xs rounded-full font-medium bg-zinc-800 border border-zinc-700/50 text-zinc-300">
                  Bun Runtime
                </span>
                <span className="px-3 py-1 text-xs rounded-full font-medium bg-purple-500/10 border border-purple-500/20 text-purple-300">
                  LuaLaTeX Engine
                </span>
                <span className="px-3 py-1 text-xs rounded-full font-medium bg-zinc-800 border border-zinc-700/50 text-zinc-300">
                  Framer Motion
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
                AozoraTeX Studio{" "}
                <span className="text-sm font-normal py-1 px-2.5 rounded-lg bg-white/5 text-zinc-400">
                  v2.0
                </span>
              </h1>
              <p className="text-zinc-400 text-sm sm:text-base max-w-2xl leading-relaxed">
                青空文庫の HTML
                ファイルから、デバイスサイズ、配色、フォント、装飾、段組をリアルタイムでカスタマイズし、高品質な縦書き
                PDF を生成するデスクトップ・組版スタジオ。
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="/static/docs/index.html"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition"
                >
                  マニュアル <ExternalLink size={12} />
                </a>
                <span className="text-zinc-700">|</span>
                <a
                  href="/static/docs/manuals/colors-visualizer.html"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition"
                >
                  カラーパレット一覧 <ExternalLink size={12} />
                </a>
                <span className="text-zinc-700">|</span>
                <a
                  href="/static/docs/manuals/font-selection.html"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 transition"
                >
                  フォント選定ガイド <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Current Selection summary box */}
            <div className="w-full lg:w-80 rounded-2xl bg-white/[0.02] border border-white/5 p-5 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                現在の設定サマリー
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-zinc-500">入力対象</span>
                  <span className="font-semibold text-zinc-300">
                    {data.selectedFiles.length} 件選択中
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-zinc-500">出力サイズ</span>
                  <span className="font-semibold text-zinc-300 capitalize">
                    {data.selectedDevice} ({data.deviceOrientation})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-zinc-500">配色パターン</span>
                  <span className="font-semibold text-zinc-300">
                    BG: {data.bgColor} / FG: {data.fgColor}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-500">組版フォント</span>
                  <span className="font-semibold text-zinc-300 truncate max-w-[150px]">
                    {data.selectedFont || "未読み込み"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Global Progress Bar */}
        <section className="rounded-2xl border border-white/5 bg-zinc-900/40 p-5 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">
              変換プロセス
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
              {compile.progressLabel}
            </span>
          </div>
          <div className="w-full bg-zinc-950 h-3 rounded-full overflow-hidden p-[2px]">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${compile.progress}%` }}
              transition={{ ease: "easeInOut" }}
            />
          </div>
        </section>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Main Controls Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* Step 1: Source Files list */}
            <StepCard
              stepLabel="Step 1"
              title="入力ファイル選択"
              description="単体選択と複数選択の両方に対応しています。"
              icon={<FileText size={18} />}
              headerAction={
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 font-semibold">
                  {data.selectedFiles.length} 件選択
                </span>
              }
            >
              <FileSelector
                files={data.files}
                filteredAndSortedFiles={data.filteredAndSortedFiles}
                selectedFiles={data.selectedFiles}
                searchQuery={data.searchQuery}
                sortBy={data.sortBy}
                onSearchChange={data.setSearchQuery}
                onSortChange={data.setSortBy}
                onToggle={data.toggleFile}
                onSelectAll={data.selectAllFiles}
                onClearAll={data.clearAllFiles}
              />
            </StepCard>

            {/* Step 2: Output Device sizes */}
            <StepCard
              stepLabel="Step 2"
              title="出力デバイスサイズ選択"
              description="端末ごとの仕上がり寸法を確認しながら選べます。"
              icon={<Laptop size={18} />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.keys(data.devices).map((devKey) => {
                  const dev = data.devices[devKey];
                  const isSelected = data.selectedDevice === devKey;
                  return (
                    <div
                      key={devKey}
                      onClick={() => data.setSelectedDevice(devKey)}
                      className={`rounded-2xl p-5 border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-purple-500/[0.04] border-purple-500 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                          : "bg-zinc-950/40 border-white/5 hover:border-zinc-700 hover:bg-zinc-900/40"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-xs font-semibold uppercase tracking-wider ${
                              isSelected ? "text-purple-400" : "text-zinc-500"
                            }`}
                          >
                            {devKey}
                          </span>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                        </div>
                        <h3 className="text-sm font-bold text-white capitalize">
                          {devKey === "smart"
                            ? "スマートフォン"
                            : devKey === "tablet"
                              ? "タブレット"
                              : "A4 / PC"}
                        </h3>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/5 text-xs text-zinc-400 space-y-1">
                        <div>
                          寸法: {dev.width_mm} x {dev.height_mm} mm
                        </div>
                        <div>標準文字サイズ: {dev.font_size} pt</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Show display orientation for responsive devices */}
              {data.selectedDevice !== "pc" && (
                <div className="pt-2">
                  <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2 d-block">
                    表示方向
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-zinc-950/50 p-1 border border-white/5 rounded-xl">
                    <button
                      onClick={() => data.setDeviceOrientation("portrait")}
                      className={`py-2 text-xs font-medium rounded-lg transition ${
                        data.deviceOrientation === "portrait"
                          ? "bg-zinc-800 text-white font-semibold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Portrait（縦向き）
                    </button>
                    <button
                      onClick={() => data.setDeviceOrientation("landscape")}
                      className={`py-2 text-xs font-medium rounded-lg transition ${
                        data.deviceOrientation === "landscape"
                          ? "bg-zinc-800 text-white font-semibold"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      Landscape（横向き）
                    </button>
                  </div>
                </div>
              )}
            </StepCard>

            {/* Step 3: Colors */}
            <StepCard
              stepLabel="Step 3"
              title="配色選定とカラーパレット"
              description="プレビューを確認しながら配色を変更できます。"
              icon={<Palette size={18} />}
            >
              {/* Preset palettes selection */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                  カラーパレット見本
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-9 gap-2">
                  {data.colorPresets.map((scheme, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        data.setBgColor(scheme.bg);
                        data.setFgColor(scheme.fg);
                      }}
                      className="group relative rounded-xl border border-white/5 overflow-hidden cursor-pointer h-10 transition hover:border-zinc-600 flex"
                    >
                      <div className="flex-1" style={{ backgroundColor: scheme.bg }} />
                      <div className="flex-1" style={{ backgroundColor: scheme.fg }} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white uppercase">
                          {scheme.name || `P-${idx + 1}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Color pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 align-items-end pt-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="bg-pick-ref"
                    className="text-xs text-zinc-500 font-semibold uppercase tracking-wider"
                  >
                    背景色
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-950/50 border border-white/5 rounded-xl p-1.5">
                    <input
                      id="bg-pick-ref"
                      type="color"
                      value={data.bgColor}
                      onChange={(e) => data.setBgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={data.bgColor.toUpperCase()}
                      onChange={(e) => data.setBgColor(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-zinc-300 font-mono w-24 border-0 focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="fg-pick-ref"
                    className="text-xs text-zinc-500 font-semibold uppercase tracking-wider"
                  >
                    文字色
                  </label>
                  <div className="flex items-center gap-2 bg-zinc-950/50 border border-white/5 rounded-xl p-1.5">
                    <input
                      id="fg-pick-ref"
                      type="color"
                      value={data.fgColor}
                      onChange={(e) => data.setFgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={data.fgColor.toUpperCase()}
                      onChange={(e) => data.setFgColor(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-zinc-300 font-mono w-24 border-0 focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={data.handleSaveSettings}
                    className="w-full py-3 text-sm font-bold bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-xl shadow-lg transition"
                  >
                    設定を保存する
                  </button>
                </div>
              </div>

              {/* Sample preview block */}
              <div className="rounded-xl border border-white/5 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-950/80 border-b border-white/5 text-xs text-zinc-500 font-mono">
                  配色プレビュー
                </div>
                <div
                  className="p-6 transition-all duration-300 text-lg flex items-center justify-center font-serif leading-loose text-center h-28"
                  style={{ backgroundColor: data.bgColor, color: data.fgColor }}
                >
                  春はあけぼの。やうやう白くなりゆく山ぎは、少しあかりて、紫だちたる雲のほそくたなびきたる。
                </div>
              </div>
            </StepCard>

            {/* Step 4: Font setup */}
            <StepCard
              stepLabel="Step 4"
              title="システム・日本語フォント選定"
              description="LuaLaTeX で利用できる日本語フォントを一覧から選択します。"
              icon={<Type size={18} />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7 space-y-1.5">
                  <label
                    htmlFor="font-select-ref"
                    className="text-xs text-zinc-500 font-semibold uppercase tracking-wider"
                  >
                    使用フォント
                  </label>
                  <select
                    id="font-select-ref"
                    value={data.selectedFont}
                    onChange={(e) => data.setSelectedFont(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-950 border border-white/5 rounded-xl text-zinc-200 focus:outline-none focus:border-purple-500 transition"
                  >
                    {data.fonts.length > 0 ? (
                      data.fonts.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))
                    ) : (
                      <option value="">フォント読み込み中...</option>
                    )}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label
                    htmlFor="font-size-ref"
                    className="text-xs text-zinc-500 font-semibold uppercase tracking-wider"
                  >
                    サイズ (pt)
                  </label>
                  <input
                    id="font-size-ref"
                    type="number"
                    min="6"
                    max="48"
                    step="0.1"
                    value={data.fontSize}
                    onChange={(e) => data.setFontSize(parseFloat(e.target.value) || 10)}
                    className="w-full px-3 py-2.5 text-sm bg-zinc-950 border border-white/5 rounded-xl text-zinc-200 focus:outline-none focus:border-purple-500 text-center transition"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    onClick={data.handleRefreshFonts}
                    disabled={data.isRefreshingFonts}
                    className="w-full py-2.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/50 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={data.isRefreshingFonts ? "animate-spin" : ""} />
                    一覧を再取得
                  </button>
                </div>
              </div>
              <div className="text-xs text-zinc-500 leading-normal">
                推奨フォント: <strong className="text-zinc-400">IPAmjMincho</strong>{" "}
                (学術用途・外字互換性重視) / Shippori Mincho / Yu Mincho
              </div>
            </StepCard>

            {/* Step 5: Advanced Options (Collapsible) */}
            <section className="rounded-2xl border border-white/5 bg-zinc-900/60 overflow-hidden">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-6 flex justify-between items-center hover:bg-white/[0.01] transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Sliders size={18} />
                  </div>
                  <div className="text-left">
                    <h2 className="text-lg font-bold text-white">装飾オプション（詳細設定）</h2>
                    <p className="text-xs text-zinc-400">和紙背景、外枠フレーム、表紙画像の合成</p>
                  </div>
                </div>
                {showAdvanced ? (
                  <ChevronUp size={20} className="text-zinc-400" />
                ) : (
                  <ChevronDown size={20} className="text-zinc-400" />
                )}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="border-t border-white/5 bg-zinc-950/20"
                  >
                    <div className="p-6 space-y-6">
                      {/* Background render mode toggle */}
                      <div className="space-y-2">
                        <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                          背景描画方式
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-zinc-950/80 p-1 border border-white/5 rounded-xl">
                          <button
                            onClick={() => data.setBackgroundRenderMode("tikz")}
                            className={`py-2 text-xs font-medium rounded-lg transition ${
                              data.backgroundRenderMode === "tikz"
                                ? "bg-zinc-800 text-white font-semibold"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            TikZ ベクター描画
                          </button>
                          <button
                            onClick={() => data.setBackgroundRenderMode("image")}
                            className={`py-2 text-xs font-medium rounded-lg transition ${
                              data.backgroundRenderMode === "image"
                                ? "bg-zinc-800 text-white font-semibold"
                                : "text-zinc-400 hover:text-zinc-200"
                            }`}
                          >
                            背景画像配置
                          </button>
                        </div>
                      </div>

                      {/* Checkbox settings */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 p-4 bg-zinc-900/40 border border-white/5 rounded-xl cursor-pointer hover:bg-zinc-800/40 transition">
                          <input
                            type="checkbox"
                            checked={data.mainWashiEnabled}
                            onChange={(e) => data.setMainWashiEnabled(e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-950 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-zinc-200">
                              全ページに和紙背景を適用
                            </span>
                            <p className="text-xs text-zinc-500">
                              表紙から奥付までテクスチャを敷きます
                            </p>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-4 bg-zinc-900/40 border border-white/5 rounded-xl cursor-pointer hover:bg-zinc-800/40 transition">
                          <input
                            type="checkbox"
                            checked={data.pageNumberEnabled}
                            onChange={(e) => data.setPageNumberEnabled(e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-950 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="space-y-0.5">
                            <span className="text-sm font-semibold text-zinc-200">
                              ページ番号を表示
                            </span>
                            <p className="text-xs text-zinc-500">
                              フッター中央にノンブルを配置します
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Frame configurations */}
                      <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-200">
                            本文外枠フレーム (Frame)
                          </span>
                          <input
                            type="checkbox"
                            checked={data.mainFrameEnabled}
                            onChange={(e) => data.setMainFrameEnabled(e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-950 text-purple-600 focus:ring-purple-500"
                          />
                        </div>
                        {data.mainFrameEnabled && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label htmlFor="frame-variant-ref" className="text-xs text-zinc-500">
                                フレームデザイン
                              </label>
                              <select
                                id="frame-variant-ref"
                                value={data.mainFrameVariant}
                                onChange={(e) => data.setMainFrameVariant(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-white/5 rounded-lg text-zinc-200"
                              >
                                <option value="1">シンプルな飾り枠 1</option>
                                <option value="2">細密枠 2</option>
                                <option value="3">太線太枠 3</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Column layouts */}
                      {data.selectedDevice !== "smart" && (
                        <div className="space-y-2">
                          <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                            本文ページ段組
                          </label>
                          <div className="grid grid-cols-2 gap-2 bg-zinc-950/80 p-1 border border-white/5 rounded-xl">
                            <button
                              onClick={() => data.setBodyColumnMode("single_column")}
                              className={`py-2 text-xs font-medium rounded-lg transition ${
                                data.bodyColumnMode === "single_column"
                                  ? "bg-zinc-800 text-white font-semibold"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              一段組
                            </button>
                            <button
                              onClick={() => data.setBodyColumnMode("two_column")}
                              className={`py-2 text-xs font-medium rounded-lg transition ${
                                data.bodyColumnMode === "two_column"
                                  ? "bg-zinc-800 text-white font-semibold"
                                  : "text-zinc-400 hover:text-zinc-200"
                              }`}
                            >
                              二段組
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Cover texture config */}
                      <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-zinc-200">
                            表紙背景 TikZ デザイン
                          </span>
                          <input
                            type="checkbox"
                            checked={data.coverTextureEnabled}
                            onChange={(e) => data.setCoverTextureEnabled(e.target.checked)}
                            className="rounded border-zinc-700 bg-zinc-950 text-purple-600 focus:ring-purple-500"
                          />
                        </div>
                        {data.coverTextureEnabled && (
                          <div className="space-y-1">
                            <label htmlFor="cover-texture-v-ref" className="text-xs text-zinc-500">
                              表紙パターンテンプレート
                            </label>
                            <select
                              id="cover-texture-v-ref"
                              value={data.coverTextureVariant}
                              onChange={(e) => data.setCoverTextureVariant(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-white/5 rounded-lg text-zinc-200"
                            >
                              <option value="1">デザインパターン 1</option>
                              <option value="2">デザインパターン 2</option>
                              <option value="3">デザインパターン 3</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Image background configuration options (Visible only if mode is image) */}
                      {data.backgroundRenderMode === "image" && data.backgroundAssets && (
                        <div className="border border-white/5 rounded-xl p-4 bg-zinc-950/60 space-y-4">
                          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                            画像背景配置設定
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label
                                htmlFor="cover-img-select-ref"
                                className="text-xs text-zinc-500"
                              >
                                表紙用背景画像
                              </label>
                              <select
                                id="cover-img-select-ref"
                                value={data.coverImagePath}
                                onChange={(e) => data.setCoverImagePath(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/5 rounded-lg text-zinc-200"
                              >
                                {data.backgroundAssets.cover.map((asset) => (
                                  <option key={asset.path} value={asset.path}>
                                    {asset.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500">
                                  不透明度: {data.coverImageOpacity}
                                </span>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  value={data.coverImageOpacity}
                                  onChange={(e) =>
                                    data.setCoverImageOpacity(parseFloat(e.target.value))
                                  }
                                  className="w-32 accent-purple-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label
                                htmlFor="washi-img-select-ref"
                                className="text-xs text-zinc-500"
                              >
                                全画面用背景和紙
                              </label>
                              <select
                                id="washi-img-select-ref"
                                value={data.washiImagePath}
                                onChange={(e) => data.setWashiImagePath(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-zinc-900 border border-white/5 rounded-lg text-zinc-200"
                              >
                                {data.backgroundAssets.washi.map((asset) => (
                                  <option key={asset.path} value={asset.path}>
                                    {asset.name}
                                  </option>
                                ))}
                              </select>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500">
                                  不透明度: {data.washiImageOpacity}
                                </span>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  value={data.washiImageOpacity}
                                  onChange={(e) =>
                                    data.setWashiImageOpacity(parseFloat(e.target.value))
                                  }
                                  className="w-32 accent-purple-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          {/* Right Main Sidebar Column */}
          <div className="lg:col-span-4 space-y-8">
            {/* Aspect ratio preview and text wrap checks */}
            <DevicePreview
              deviceKey={data.selectedDevice}
              widthMm={widthMm}
              heightMm={heightMm}
              orientation={data.deviceOrientation}
              bgColor={data.bgColor}
              fgColor={data.fgColor}
              selectedFont={data.selectedFont}
              sampleText={SIZE_REFERENCE_SAMPLE}
            />

            {/* Step 7: Execution Console */}
            <StepCard
              stepLabel="Step 6"
              title="生成と管理コンソール"
              description="現在の選択設定で PDF を生成します。保守・初期化・サーバー停止も可能です。"
            >
              {/* Generate buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => triggerCompile(false)}
                  disabled={compile.isCompiling || data.selectedFiles.length === 0}
                  className="w-full py-4 text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:from-purple-700 active:to-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Play size={16} fill="currentColor" />
                  選択ファイルをPDF化
                </button>

                <button
                  onClick={() => triggerCompile(true)}
                  disabled={compile.isCompiling || data.files.length === 0}
                  className="w-full py-3.5 text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 border border-zinc-700/50 rounded-xl transition flex items-center justify-center gap-2"
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
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  }`}
                >
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
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

              {/* Maintenance utilities */}
              <div className="grid grid-cols-2 gap-2.5 border-t border-white/5 pt-4">
                <button
                  onClick={data.handleCleanup}
                  className="py-2.5 px-3 text-xs font-semibold bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-300 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  中間ファイル削除
                </button>

                <button
                  onClick={data.handleResetSettings}
                  className="py-2.5 px-3 text-xs font-semibold bg-zinc-900 border border-white/5 hover:bg-zinc-800 text-zinc-300 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={13} />
                  設定初期化
                </button>

                <button
                  onClick={data.handleStopServer}
                  className="col-span-2 py-3 px-3 text-xs font-semibold bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Power size={13} />
                  サーバー停止
                </button>
              </div>
            </StepCard>

            {/* Logging terminal */}
            <Terminal
              logs={compile.compileLogs}
              visible={compile.isCompiling || compile.compileLogs.length > 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
