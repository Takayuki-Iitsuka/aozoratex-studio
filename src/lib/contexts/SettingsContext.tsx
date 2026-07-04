"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

export interface DeviceConfig {
  width?: number;
  height?: number;
  font_size: number;
  width_mm: number;
  height_mm: number;
  base_width?: number;
  base_height?: number;
  label?: string;
  category?: "smartphone" | "tablet" | "pc" | string;
  default?: boolean;
  margin_top_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  margin_right_mm: number;
  mode: string;
  show_page_number: boolean;
  orientation: string;
  supports_orientation?: boolean;
  supports_columns?: boolean;
  line_gap_ratio: number;
  line_leading_ratio: number;
  character_spacing_zw: number;
}

export interface BackgroundAssets {
  cover: Array<{ name: string; path: string }>;
  washi: Array<{ name: string; path: string }>;
  defaults: { cover: string; washi: string };
}

export interface ColorScheme {
  bg: string;
  fg: string;
  name?: string;
  label?: string;
  contrast?: number;
}

interface SettingsContextValue {
  devices: Record<string, DeviceConfig>;
  selectedDevice: string;
  setSelectedDevice: (d: string) => void;
  deviceOrientation: string;
  setDeviceOrientation: (o: string) => void;

  bgColor: string;
  setBgColor: (c: string) => void;
  fgColor: string;
  setFgColor: (c: string) => void;
  colorPresets: ColorScheme[];

  fonts: string[];
  selectedFont: string;
  setSelectedFont: (f: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  isRefreshingFonts: boolean;

  backgroundRenderMode: "tikz" | "image";
  setBackgroundRenderMode: (m: "tikz" | "image") => void;
  mainWashiEnabled: boolean;
  setMainWashiEnabled: (v: boolean) => void;
  mainFrameEnabled: boolean;
  setMainFrameEnabled: (v: boolean) => void;
  mainFrameVariant: string;
  setMainFrameVariant: (v: string) => void;
  coverTextureEnabled: boolean;
  setCoverTextureEnabled: (v: boolean) => void;
  coverTextureVariant: string;
  setCoverTextureVariant: (v: string) => void;
  pageNumberEnabled: boolean;
  setPageNumberEnabled: (v: boolean) => void;
  bodyColumnMode: string;
  setBodyColumnMode: (v: string) => void;

  backgroundAssets: BackgroundAssets | null;
  coverImagePath: string;
  setCoverImagePath: (p: string) => void;
  washiImagePath: string;
  setWashiImagePath: (p: string) => void;
  coverImageOpacity: number;
  setCoverImageOpacity: (o: number) => void;
  washiImageOpacity: number;
  setWashiImageOpacity: (o: number) => void;

  handleRefreshFonts: () => Promise<void>;
  handleSaveSettings: () => Promise<void>;
  handleResetSettings: () => Promise<void>;
  reloadDevices: () => Promise<void>;
}

// Color Scheme 一覧ページ（colors-visualizer.html）との連携用定数。
// colors.js 側の定義と一致させること
const SETTINGS_CHANNEL_NAME = "aozoratex-settings";
const APPLY_SCHEME_MESSAGE_TYPE = "AOZORATEX_APPLY_COLOR_SCHEME";
const APPLY_SCHEME_ACK_TYPE = "AOZORATEX_APPLY_COLOR_SCHEME_ACK";
const PENDING_SCHEME_KEY = "aozoratex_pending_color_scheme";

interface CatalogColorScheme {
  name?: string;
  bg?: string;
  fg?: string;
  font?: string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Record<string, DeviceConfig>>({});
  const [selectedDevice, setSelectedDevice] = useState<string>("iphone");
  const [deviceOrientation, setDeviceOrientation] = useState<string>("portrait");

  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [fgColor, setFgColor] = useState("#000000");
  const [colorPresets, setColorPresets] = useState<ColorScheme[]>([]);

  const [fonts, setFonts] = useState<string[]>([]);
  const [selectedFont, setSelectedFont] = useState("");
  const [fontSize, setFontSize] = useState(13.5);
  const [isRefreshingFonts, setIsRefreshingFonts] = useState(false);

  const [backgroundRenderMode, setBackgroundRenderMode] = useState<"tikz" | "image">("tikz");
  const [mainWashiEnabled, setMainWashiEnabled] = useState(false);
  const [mainFrameEnabled, setMainFrameEnabled] = useState(false);
  const [mainFrameVariant, setMainFrameVariant] = useState("1");
  const [coverTextureEnabled, setCoverTextureEnabled] = useState(false);
  const [coverTextureVariant, setCoverTextureVariant] = useState("1");
  const [pageNumberEnabled, setPageNumberEnabled] = useState(true);
  const [bodyColumnMode, setBodyColumnMode] = useState("single_column");

  const [backgroundAssets, setBackgroundAssets] = useState<BackgroundAssets | null>(null);
  const [coverImagePath, setCoverImagePath] = useState("");
  const [washiImagePath, setWashiImagePath] = useState("");
  const [coverImageOpacity, setCoverImageOpacity] = useState(0.92);
  const [washiImageOpacity, setWashiImageOpacity] = useState(0.18);

  // 保存済み設定をローカル state に反映する（初期ロード・リセット後で共用）
  const applySettings = (
    settings: Record<string, unknown>,
    assetDefaults?: { cover?: string; washi?: string }
  ) => {
    const readString = (key: string, fallback = "") =>
      typeof settings[key] === "string" ? settings[key] : fallback;
    const readBool = (key: string, fallback: boolean) => {
      const value = settings[key];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value === "true";
      return fallback;
    };

    setBgColor(readString("background_color", "#FFFFFF"));
    setFgColor(readString("text_color", "#000000"));
    if (settings.selected_device) {
      setSelectedDevice(String(settings.selected_device));
    }
    setMainWashiEnabled(readBool("main_washi_enabled", false));
    setMainFrameEnabled(readBool("main_frame_enabled", false));
    setMainFrameVariant(readString("main_frame_variant", "1"));
    setCoverTextureEnabled(readBool("cover_texture_enabled", false));
    setCoverTextureVariant(readString("cover_texture_variant", "1"));
    setBackgroundRenderMode(readString("background_render_mode") === "image" ? "image" : "tikz");
    setCoverImagePath(readString("cover_image_path", assetDefaults?.cover || ""));
    setWashiImagePath(readString("washi_image_path", assetDefaults?.washi || ""));
    setCoverImageOpacity(parseFloat(readString("cover_image_opacity", "0.92")));
    setWashiImageOpacity(parseFloat(readString("washi_image_opacity", "0.18")));
    setPageNumberEnabled(readBool("page_number_enabled", true));
    setBodyColumnMode(readString("body_column_mode", "single_column"));
  };

  // 初期データの一括取得（並列）
  useEffect(() => {
    const fetchJson = async (url: string) => {
      const res = await fetch(url);
      return res.json();
    };

    const loadInitialData = async () => {
      try {
        const [jsonDevices, jsonAssets, jsonSettings, jsonColors, jsonFonts] = await Promise.all([
          fetchJson("/api/devices"),
          fetchJson("/api/background-assets"),
          fetchJson("/api/settings"),
          fetchJson("/api/colors?mode=all&limit=9"),
          fetchJson("/api/lualatex-fonts"),
        ]);

        const devicePayload = jsonDevices.devices || jsonDevices;
        if (devicePayload) {
          setDevices(devicePayload);
          const defaultDevice = Object.entries(devicePayload).find(
            ([, device]) => (device as DeviceConfig).default
          );
          if (defaultDevice) setSelectedDevice(defaultDevice[0]);
        }

        if (jsonAssets.success) {
          setBackgroundAssets(jsonAssets);
          setCoverImagePath(jsonAssets.defaults.cover || "");
          setWashiImagePath(jsonAssets.defaults.washi || "");
        }

        if (jsonSettings.success && jsonSettings.settings) {
          applySettings(jsonSettings.settings.global || {}, jsonAssets.defaults);
        }

        if (jsonColors.schemes) setColorPresets(jsonColors.schemes);

        if (jsonFonts.success && jsonFonts.fonts) {
          const fontList = jsonFonts.fonts.map((f: { name: string }) => f.name);
          setFonts(fontList);
          if (fontList.length > 0) setSelectedFont(fontList[0]);
        }

        // Color Scheme 一覧で保留保存された配色があれば適用する
        // （一覧ページ操作時にアプリのタブが開いていなかったケース）
        applyPendingColorScheme();
      } catch (err) {
        console.error("Failed to load initial studio configurations:", err);
      }
    };

    // colors-visualizer.html から受け取った配色をプレビュー state に反映する
    const applyColorScheme = (scheme: CatalogColorScheme, message: string) => {
      if (!scheme?.bg || !scheme?.fg) return;
      setBgColor(scheme.bg);
      setFgColor(scheme.fg);
      if (scheme.font) {
        setSelectedFont(scheme.font);
      }
      toast.success(message);
    };

    const applyPendingColorScheme = () => {
      try {
        const raw = localStorage.getItem(PENDING_SCHEME_KEY);
        if (!raw) return;
        localStorage.removeItem(PENDING_SCHEME_KEY);
        const scheme = JSON.parse(raw) as CatalogColorScheme;
        applyColorScheme(scheme, `保留中の配色「${scheme.name}」を反映しました。`);
      } catch (err) {
        console.error("Failed to apply pending color scheme:", err);
      }
    };

    loadInitialData();

    // Color Scheme 一覧（別タブ）からの BroadcastChannel 受信。受信したら ACK を返す
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SETTINGS_CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === APPLY_SCHEME_MESSAGE_TYPE && event.data.scheme) {
          const scheme = event.data.scheme as CatalogColorScheme;
          applyColorScheme(scheme, `「${scheme.name}」をプレビューに反映しました。`);
          channel?.postMessage({ type: APPLY_SCHEME_ACK_TYPE, name: scheme.name });
        }
      };
    } catch {
      // BroadcastChannel 非対応環境では postMessage 経路のみで動作する
    }

    // postMessage 経路（iframe 埋め込み・旧リンクとの後方互換）
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === APPLY_SCHEME_MESSAGE_TYPE && event.data.scheme) {
        const scheme = event.data.scheme as CatalogColorScheme;
        applyColorScheme(scheme, `「${scheme.name}」をプレビューに反映しました。`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      channel?.close();
    };
  }, []);

  // デバイス切替（または devices ロード）時に既定フォントサイズ・段組を同期。
  // effect 内 setState はカスケードレンダーを招くため、
  // 「レンダー中に前回値と比較して調整する」React 推奨パターンで実装
  const [prevDeviceConfig, setPrevDeviceConfig] = useState<DeviceConfig | null>(null);
  const currentDeviceConfig = devices[selectedDevice] ?? null;
  if (currentDeviceConfig !== prevDeviceConfig) {
    setPrevDeviceConfig(currentDeviceConfig);
    if (currentDeviceConfig) {
      setFontSize(currentDeviceConfig.font_size);
      setBodyColumnMode(currentDeviceConfig.mode || "single_column");
      setDeviceOrientation(currentDeviceConfig.orientation || "portrait");
    }
  }

  // 端末初期値の編集後などに、実効デバイス値（default+custom マージ結果）を再取得する
  const reloadDevices = async () => {
    try {
      const res = await fetch("/api/devices");
      const json = await res.json();
      const devicePayload = json.devices || json;
      if (devicePayload) setDevices(devicePayload);
    } catch (err) {
      console.error("Failed to reload devices:", err);
    }
  };

  const handleRefreshFonts = async () => {
    setIsRefreshingFonts(true);
    try {
      const res = await fetch("/api/lualatex-fonts?refresh=true");
      const json = await res.json();
      if (json.success && json.fonts) {
        const fontList = json.fonts.map((f: { name: string }) => f.name);
        setFonts(fontList);
        if (fontList.length > 0) setSelectedFont(fontList[0]);
      }
    } catch (err) {
      console.error("Font refresh failed:", err);
    } finally {
      setIsRefreshingFonts(false);
    }
  };

  const handleSaveSettings = async () => {
    const payload = {
      global: {
        selected_device: selectedDevice,
        background_color: bgColor,
        text_color: fgColor,
        main_washi_enabled: String(mainWashiEnabled),
        main_frame_enabled: String(mainFrameEnabled),
        main_frame_variant: mainFrameVariant,
        cover_texture_enabled: String(coverTextureEnabled),
        cover_texture_variant: coverTextureVariant,
        background_render_mode: backgroundRenderMode,
        cover_image_path: coverImagePath,
        cover_image_opacity: String(coverImageOpacity),
        washi_image_path: washiImagePath,
        washi_image_opacity: String(washiImageOpacity),
        page_number_enabled: String(pageNumberEnabled),
        body_column_mode: bodyColumnMode,
      },
      devices: {
        [selectedDevice]: {
          orientation: devices[selectedDevice]?.supports_orientation
            ? deviceOrientation
            : "portrait",
          mode: devices[selectedDevice]?.supports_columns
            ? bodyColumnMode
            : "single_column",
        },
      },
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) toast.success("設定を保存しました。");
      else toast.error("設定の保存に失敗しました。");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("設定の保存に失敗しました。");
    }
  };

  const handleResetSettings = async () => {
    if (!confirm("すべてのカスタム設定を初期デフォルトに戻しますか？")) return;
    try {
      const res = await fetch("/api/settings/reset", { method: "POST" });
      const data = await res.json();
      if (data.success && data.settings) {
        applySettings(data.settings.global || {});
        if (data.settings.devices) setDevices(data.settings.devices);
        toast.success("設定を初期化しました。");
      }
    } catch (err) {
      console.error("Failed to reset settings:", err);
      toast.error("設定のリセットに失敗しました。");
    }
  };

  const value: SettingsContextValue = {
    devices,
    selectedDevice,
    setSelectedDevice,
    deviceOrientation,
    setDeviceOrientation,
    bgColor,
    setBgColor,
    fgColor,
    setFgColor,
    colorPresets,
    fonts,
    selectedFont,
    setSelectedFont,
    fontSize,
    setFontSize,
    isRefreshingFonts,
    backgroundRenderMode,
    setBackgroundRenderMode,
    mainWashiEnabled,
    setMainWashiEnabled,
    mainFrameEnabled,
    setMainFrameEnabled,
    mainFrameVariant,
    setMainFrameVariant,
    coverTextureEnabled,
    setCoverTextureEnabled,
    coverTextureVariant,
    setCoverTextureVariant,
    pageNumberEnabled,
    setPageNumberEnabled,
    bodyColumnMode,
    setBodyColumnMode,
    backgroundAssets,
    coverImagePath,
    setCoverImagePath,
    washiImagePath,
    setWashiImagePath,
    coverImageOpacity,
    setCoverImageOpacity,
    washiImageOpacity,
    setWashiImageOpacity,
    handleRefreshFonts,
    handleSaveSettings,
    handleResetSettings,
    reloadDevices,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings は SettingsProvider の内側で使用してください");
  return ctx;
}
