"use client";

import React, { useState } from "react";
import {
  Palette,
  Type,
  Sliders,
  Save,
  RotateCcw,
  RefreshCw,
  Trash2,
  Power,
  Wrench,
  Smartphone,
  Tablet,
  Monitor,
  Download,
  MoreHorizontal,
  ExternalLink
} from "lucide-react";

import { useSettings, type DeviceConfig } from "@/lib/contexts/SettingsContext";
import { useSystemActions } from "@/lib/hooks/useSystemActions";
import { StepCard } from "@/components/StepCard";
import { DeviceDefaultsEditor } from "@/components/DeviceDefaultsEditor";

export default function SettingsPage() {
  const settings = useSettings();
  const system = useSystemActions();
  const activeDevice = settings.devices[settings.selectedDevice];
  
  const [activeTab, setActiveTab] = useState("color_font");
  const [saveAsName, setSaveAsName] = useState("aozoratex_settings.json");

  const groupedDevices = {
    smartphone: Object.entries(settings.devices).filter(([, device]) => device.category === "smartphone"),
    tablet: Object.entries(settings.devices).filter(([, device]) => device.category === "tablet"),
    pc: Object.entries(settings.devices).filter(([, device]) => device.category === "pc"),
  };

  const renderDeviceButtons = (
    entries: Array<[string, DeviceConfig]>,
    emptyLabel: string
  ) => {
    if (entries.length === 0) {
      return <div className="text-xs text-muted-foreground">{emptyLabel}</div>;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {entries.map(([deviceKey, device]) => {
          const selected = settings.selectedDevice === deviceKey;
          return (
            <button
              key={deviceKey}
              type="button"
              onClick={() => settings.setSelectedDevice(deviceKey)}
              className={`text-left rounded-lg border p-3 transition ${
                selected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-input/40 text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="block text-xs font-bold">{device.label || deviceKey}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {device.width_mm} x {device.height_mm} mm / {device.font_size} pt
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const handleSaveAs = () => {
    const payload = {
      global: {
        selected_device: settings.selectedDevice,
        background_color: settings.bgColor,
        text_color: settings.fgColor,
        main_washi_enabled: String(settings.mainWashiEnabled),
        main_frame_enabled: String(settings.mainFrameEnabled),
        main_frame_variant: settings.mainFrameVariant,
        cover_texture_enabled: String(settings.coverTextureEnabled),
        cover_texture_variant: settings.coverTextureVariant,
        background_render_mode: settings.backgroundRenderMode,
        cover_image_path: settings.coverImagePath,
        cover_image_opacity: String(settings.coverImageOpacity),
        washi_image_path: settings.washiImagePath,
        washi_image_opacity: String(settings.washiImageOpacity),
        page_number_enabled: String(settings.pageNumberEnabled),
        body_column_mode: settings.bodyColumnMode,
      },
      devices: {
        [settings.selectedDevice]: {
          orientation: settings.devices[settings.selectedDevice]?.supports_orientation
            ? settings.deviceOrientation
            : "portrait",
          mode: settings.devices[settings.selectedDevice]?.supports_columns
            ? settings.bodyColumnMode
            : "single_column",
        },
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = saveAsName || "aozoratex_settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: "color_font", label: "配色・フォント関連", icon: <Palette size={16} /> },
    { id: "decoration", label: "装飾関連", icon: <Sliders size={16} /> },
    { id: "terminal", label: "端末関連", icon: <Smartphone size={16} /> },
    { id: "maintenance", label: "メンテナンス", icon: <Wrench size={16} /> },
    { id: "other", label: "その他", icon: <MoreHorizontal size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight">設定</h1>
          <p className="text-sm text-muted-foreground">
            PDF組版の設定を調整します。保存した設定はすべての生成で使われます。
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={settings.handleResetSettings}
            className="px-4 py-2.5 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            初期化
          </button>
          <button
            onClick={settings.handleSaveSettings}
            className="px-5 py-2.5 text-xs font-bold bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl shadow-lg transition flex items-center gap-1.5"
          >
            <Save size={13} />
            設定を保存する
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 items-start">
        {activeTab === "color_font" && (
          <div className="space-y-6">
            <StepCard
              title="配色とカラーパレット"
              description="プレビューを確認しながら本文の背景色・文字色を変更できます。"
              icon={<Palette size={18} />}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    カラーパレット見本
                  </label>
                  <a
                    href="/static/docs/manuals/colors-visualizer.html"
                    target="_blank"
                    rel="opener"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline transition font-bold"
                  >
                    <ExternalLink size={11} />
                    Color Scheme 一覧で詳細に探す
                  </a>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                  {settings.colorPresets.map((scheme, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        settings.setBgColor(scheme.bg);
                        settings.setFgColor(scheme.fg);
                      }}
                      className="group relative rounded-xl border border-border overflow-hidden cursor-pointer h-10 transition hover:border-accent flex"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="bg-pick"
                    className="text-xs text-muted-foreground font-semibold uppercase tracking-wider"
                  >
                    背景色
                  </label>
                  <div className="flex items-center gap-2 bg-input border border-border rounded-xl p-1.5">
                    <input
                      id="bg-pick"
                      type="color"
                      value={settings.bgColor}
                      onChange={(e) => settings.setBgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.bgColor.toUpperCase()}
                      onChange={(e) => settings.setBgColor(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-foreground/90 font-mono w-24 border-0 focus:ring-0 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="fg-pick"
                    className="text-xs text-muted-foreground font-semibold uppercase tracking-wider"
                  >
                    文字色
                  </label>
                  <div className="flex items-center gap-2 bg-input border border-border rounded-xl p-1.5">
                    <input
                      id="fg-pick"
                      type="color"
                      value={settings.fgColor}
                      onChange={(e) => settings.setFgColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.fgColor.toUpperCase()}
                      onChange={(e) => settings.setFgColor(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-foreground/90 font-mono w-24 border-0 focus:ring-0 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden mt-4">
                <div className="px-4 py-2.5 bg-muted/60 border-b border-border text-xs text-muted-foreground font-mono">
                  配色プレビュー
                </div>
                <div
                  className="p-6 transition-all duration-300 text-lg flex items-center justify-center font-serif leading-loose text-center h-28"
                  style={{ backgroundColor: settings.bgColor, color: settings.fgColor }}
                >
                  春はあけぼの。やうやう白くなりゆく山ぎは、少しあかりて、紫だちたる雲のほそくたなびきたる。
                </div>
              </div>
            </StepCard>

            <StepCard
              title="日本語フォント選定"
              description="LuaLaTeX で利用できる日本語フォントを一覧から選択します。"
              icon={<Type size={18} />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7 space-y-1.5">
                  <label
                    htmlFor="font-select"
                    className="text-xs text-muted-foreground font-semibold uppercase tracking-wider"
                  >
                    使用フォント
                  </label>
                  <select
                    id="font-select"
                    value={settings.selectedFont}
                    onChange={(e) => settings.setSelectedFont(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-input border border-border rounded-xl text-foreground focus:outline-hidden focus:border-accent transition"
                  >
                    {settings.fonts.length > 0 ? (
                      settings.fonts.map((f) => (
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
                    htmlFor="font-size"
                    className="text-xs text-muted-foreground font-semibold uppercase tracking-wider"
                  >
                    サイズ (pt)
                  </label>
                  <input
                    id="font-size"
                    type="number"
                    min="6"
                    max="48"
                    step="0.1"
                    value={settings.fontSize}
                    onChange={(e) => settings.setFontSize(parseFloat(e.target.value) || 10)}
                    className="w-full px-3 py-2.5 text-sm bg-input border border-border rounded-xl text-foreground focus:outline-hidden focus:border-accent text-center transition"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    onClick={settings.handleRefreshFonts}
                    disabled={settings.isRefreshingFonts}
                    className="w-full py-2.5 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={settings.isRefreshingFonts ? "animate-spin" : ""}
                    />
                    一覧を再取得
                  </button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-normal mt-3">
                推奨フォント: <strong className="text-foreground/80">IPAmjMincho</strong>{" "}
                (学術用途・外字互換性重視) / Shippori Mincho / Yu Mincho。
                文字サイズの標準値は出力デバイスごとに定義されています。
              </div>
            </StepCard>
          </div>
        )}

        {activeTab === "decoration" && (
          <div className="space-y-6">
            <StepCard
              title="装飾オプション"
              description="和紙背景、外枠フレーム、表紙デザイン、段組を調整します。"
              icon={<Sliders size={18} />}
            >
              {/* 背景描画方式 */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  背景描画方式
                </label>
                <div className="grid grid-cols-2 gap-2 bg-input/60 p-1 border border-border rounded-xl">
                  <button
                    onClick={() => settings.setBackgroundRenderMode("tikz")}
                    className={`py-2 text-xs font-medium rounded-lg transition ${
                      settings.backgroundRenderMode === "tikz"
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    TikZ ベクター描画
                  </button>
                  <button
                    onClick={() => settings.setBackgroundRenderMode("image")}
                    className={`py-2 text-xs font-medium rounded-lg transition ${
                      settings.backgroundRenderMode === "image"
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    背景画像配置
                  </button>
                </div>
              </div>

              {/* トグル群 */}
              <div className="grid grid-cols-1 gap-3 mt-4">
                <label className="flex items-center gap-3 p-4 bg-input/40 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition">
                  <input
                    type="checkbox"
                    checked={settings.mainWashiEnabled}
                    onChange={(e) => settings.setMainWashiEnabled(e.target.checked)}
                    className="accent-[--color-accent]"
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-foreground/90">
                      全ページに和紙背景を適用
                    </span>
                    <p className="text-xs text-muted-foreground">
                      表紙から奥付までテクスチャを敷きます
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-input/40 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition">
                  <input
                    type="checkbox"
                    checked={settings.pageNumberEnabled}
                    onChange={(e) => settings.setPageNumberEnabled(e.target.checked)}
                    className="accent-[--color-accent]"
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-foreground/90">ページ番号を表示</span>
                    <p className="text-xs text-muted-foreground">
                      フッター中央にノンブルを配置します
                    </p>
                  </div>
                </label>
              </div>

              {/* 外枠フレーム */}
              <div className="p-4 bg-input/40 border border-border rounded-xl space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground/90">
                    本文外枠フレーム (Frame)
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.mainFrameEnabled}
                    onChange={(e) => settings.setMainFrameEnabled(e.target.checked)}
                    className="accent-[--color-accent]"
                  />
                </div>
                {settings.mainFrameEnabled && (
                  <div className="space-y-1">
                    <label htmlFor="frame-variant" className="text-xs text-muted-foreground">
                      フレームデザイン
                    </label>
                    <select
                      id="frame-variant"
                      value={settings.mainFrameVariant}
                      onChange={(e) => settings.setMainFrameVariant(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground"
                    >
                      <option value="1">シンプルな飾り枠 1</option>
                      <option value="2">細密枠 2</option>
                      <option value="3">太線太枠 3</option>
                    </select>
                  </div>
                )}
              </div>

              {/* 表紙テクスチャ */}
              <div className="p-4 bg-input/40 border border-border rounded-xl space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground/90">
                    表紙背景 TikZ デザイン
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.coverTextureEnabled}
                    onChange={(e) => settings.setCoverTextureEnabled(e.target.checked)}
                    className="accent-[--color-accent]"
                  />
                </div>
                {settings.coverTextureEnabled && (
                  <div className="space-y-1">
                    <label htmlFor="cover-texture-v" className="text-xs text-muted-foreground">
                      表紙パターンテンプレート
                    </label>
                    <select
                      id="cover-texture-v"
                      value={settings.coverTextureVariant}
                      onChange={(e) => settings.setCoverTextureVariant(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground"
                    >
                      <option value="1">デザインパターン 1</option>
                      <option value="2">デザインパターン 2</option>
                      <option value="3">デザインパターン 3</option>
                    </select>
                  </div>
                )}
              </div>

              {/* 画像背景（image モード時のみ） */}
              {settings.backgroundRenderMode === "image" && settings.backgroundAssets && (
                <div className="border border-border rounded-xl p-4 bg-input/40 space-y-4 mt-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    画像背景配置設定
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="cover-img-select" className="text-xs text-muted-foreground">
                        表紙用背景画像
                      </label>
                      <select
                        id="cover-img-select"
                        value={settings.coverImagePath}
                        onChange={(e) => settings.setCoverImagePath(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground"
                      >
                        {settings.backgroundAssets.cover.map((asset) => (
                          <option key={asset.path} value={asset.path}>
                            {asset.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">
                          不透明度: {settings.coverImageOpacity}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={settings.coverImageOpacity}
                          onChange={(e) =>
                            settings.setCoverImageOpacity(parseFloat(e.target.value))
                          }
                          className="w-32 accent-purple-500 h-1 bg-muted rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="washi-img-select" className="text-xs text-muted-foreground">
                        全画面用背景和紙
                      </label>
                      <select
                        id="washi-img-select"
                        value={settings.washiImagePath}
                        onChange={(e) => settings.setWashiImagePath(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground"
                      >
                        {settings.backgroundAssets.washi.map((asset) => (
                          <option key={asset.path} value={asset.path}>
                            {asset.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">
                          不透明度: {settings.washiImageOpacity}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={settings.washiImageOpacity}
                          onChange={(e) =>
                            settings.setWashiImageOpacity(parseFloat(e.target.value))
                          }
                          className="w-32 accent-purple-500 h-1 bg-muted rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </StepCard>
          </div>
        )}

        {activeTab === "terminal" && (
          <div className="space-y-6">
            <StepCard
              title="端末設定"
              description="PDF生成とプレビューで使う出力端末、向き、段組を選択します。"
              icon={<Smartphone size={18} />}
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    <Smartphone size={13} />
                    スマホ
                  </div>
                  {renderDeviceButtons(groupedDevices.smartphone, "スマホ端末を読み込み中...")}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    <Tablet size={13} />
                    タブレット
                  </div>
                  {renderDeviceButtons(groupedDevices.tablet, "タブレット端末を読み込み中...")}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    <Monitor size={13} />
                    PC
                  </div>
                  {renderDeviceButtons(groupedDevices.pc, "PC端末を読み込み中...")}
                </div>

                {activeDevice && (
                  <div className="rounded-xl border border-border bg-input/40 p-4 space-y-4">
                    <div className="text-sm font-semibold text-foreground/90">
                      {activeDevice.label || settings.selectedDevice}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>用紙: {activeDevice.width_mm} x {activeDevice.height_mm} mm</div>
                      <div>本文: {settings.fontSize} pt</div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        表示方向
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-input/60 p-1 border border-border rounded-xl">
                        <button
                          type="button"
                          onClick={() => settings.setDeviceOrientation("portrait")}
                          disabled={!activeDevice.supports_orientation}
                          className={`py-2 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                            settings.deviceOrientation === "portrait"
                              ? "bg-muted text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          縦向き
                        </button>
                        <button
                          type="button"
                          onClick={() => settings.setDeviceOrientation("landscape")}
                          disabled={!activeDevice.supports_orientation}
                          className={`py-2 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                            settings.deviceOrientation === "landscape"
                              ? "bg-muted text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          横向き
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                        段組
                      </label>
                      <div className="grid grid-cols-2 gap-2 bg-input/60 p-1 border border-border rounded-xl">
                        <button
                          type="button"
                          onClick={() => settings.setBodyColumnMode("single_column")}
                          disabled={!activeDevice.supports_columns}
                          className={`py-2 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                            settings.bodyColumnMode === "single_column"
                              ? "bg-muted text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          一段組
                        </button>
                        <button
                          type="button"
                          onClick={() => settings.setBodyColumnMode("two_column")}
                          disabled={!activeDevice.supports_columns}
                          className={`py-2 text-xs font-medium rounded-lg transition disabled:opacity-50 ${
                            settings.bodyColumnMode === "two_column"
                              ? "bg-muted text-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          二段組
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        スマートフォンサイズでは常に一段組で出力されます。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </StepCard>
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className="space-y-6">
            <StepCard
              title="メンテナンス"
              description="ビルド中間ファイルの掃除とサーバーの停止を行います。"
              icon={<Wrench size={18} />}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={system.handleCleanup}
                  className="py-2.5 px-3 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  中間ファイル削除
                </button>

                <button
                  onClick={system.handleStopServer}
                  className="py-2.5 px-3 text-xs font-semibold bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Power size={13} />
                  サーバー停止
                </button>
              </div>
            </StepCard>
          </div>
        )}

        {activeTab === "other" && (
          <div className="space-y-6">
            <StepCard
              title="設定の保存・エクスポート"
              description="現在の設定をJSONファイルとして名前を付けて保存（ダウンロード）できます。"
              icon={<Save size={18} />}
            >
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="save-as-name" className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    ファイル名
                  </label>
                  <input
                    id="save-as-name"
                    type="text"
                    value={saveAsName}
                    onChange={(e) => setSaveAsName(e.target.value)}
                    placeholder="aozoratex_settings.json"
                    className="w-full px-3 py-2.5 text-sm bg-input border border-border rounded-xl text-foreground focus:outline-hidden focus:border-accent transition"
                  />
                </div>
                <button
                  onClick={handleSaveAs}
                  className="py-2.5 px-4 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <Download size={14} />
                  名前を付けて保存する（ダウンロード）
                </button>
              </div>
            </StepCard>

            <StepCard
              title="各端末の初期値一覧"
              description="「設定の初期化」で戻る端末ごとの初期値を確認・編集します。"
              icon={<Smartphone size={18} />}
            >
              <DeviceDefaultsEditor onSaved={settings.reloadDevices} />
            </StepCard>

            <StepCard
              title="設定の初期化"
              description="すべてのカスタム設定をデフォルト状態に戻します。"
              icon={<RotateCcw size={18} />}
            >
              <div className="space-y-4">
                <div className="bg-input/40 border border-border rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground/90">初期化時の規定設定</h4>
                  <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                    <li><strong className="text-foreground/80">端末:</strong> iPhone（縦向き・一段組）</li>
                    <li><strong className="text-foreground/80">フォント:</strong> IPAmjMincho（学術用途推奨）</li>
                    <li><strong className="text-foreground/80">背景描画方式:</strong> TikZ ベクター描画</li>
                    <li><strong className="text-foreground/80">配色:</strong> 白背景 / 黒文字</li>
                    <li><strong className="text-foreground/80">装飾:</strong> ページ番号表示ON、和紙背景・フレームOFF</li>
                  </ul>
                </div>
                <button
                  onClick={settings.handleResetSettings}
                  className="py-2.5 px-4 text-xs font-semibold bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <RotateCcw size={14} />
                  初期化を実行する
                </button>
              </div>
            </StepCard>
          </div>
        )}
      </div>
    </div>
  );
}
