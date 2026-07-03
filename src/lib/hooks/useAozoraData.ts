import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

export interface DataFile {
  name: string;
  path: string;
}

export interface DeviceConfig {
  font_size: number;
  width_mm: number;
  height_mm: number;
  margin_top_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  margin_right_mm: number;
  mode: string;
  show_page_number: boolean;
  orientation: string;
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

export function useAozoraData() {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const [devices, setDevices] = useState<Record<string, DeviceConfig>>({});
  const [selectedDevice, setSelectedDevice] = useState<string>("smart");
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

  // Load initial settings and data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const resFiles = await fetch("/api/data-files");
        const jsonFiles = await resFiles.json();
        if (jsonFiles.success) setFiles(jsonFiles.files);

        const resDevices = await fetch("/api/devices");
        const jsonDevices = await resDevices.json();
        if (jsonDevices.devices) setDevices(jsonDevices.devices);

        const resAssets = await fetch("/api/background-assets");
        const jsonAssets = await resAssets.json();
        if (jsonAssets.success) {
          setBackgroundAssets(jsonAssets);
          setCoverImagePath(jsonAssets.defaults.cover || "");
          setWashiImagePath(jsonAssets.defaults.washi || "");
        }

        const resSettings = await fetch("/api/settings");
        const jsonSettings = await resSettings.json();
        if (jsonSettings.success && jsonSettings.settings) {
          const settings = jsonSettings.settings.global || {};
          setBgColor(settings.background_color || "#FFFFFF");
          setFgColor(settings.text_color || "#000000");
          setMainWashiEnabled(settings.main_washi_enabled === "true");
          setMainFrameEnabled(settings.main_frame_enabled === "true");
          setMainFrameVariant(settings.main_frame_variant || "1");
          setCoverTextureEnabled(settings.cover_texture_enabled === "true");
          setCoverTextureVariant(settings.cover_texture_variant || "1");
          setBackgroundRenderMode(settings.background_render_mode === "image" ? "image" : "tikz");
          setCoverImagePath(settings.cover_image_path || jsonAssets.defaults?.cover || "");
          setWashiImagePath(settings.washi_image_path || jsonAssets.defaults?.washi || "");
          setCoverImageOpacity(parseFloat(settings.cover_image_opacity || "0.92"));
          setWashiImageOpacity(parseFloat(settings.washi_image_opacity || "0.18"));
          setPageNumberEnabled(settings.page_number_enabled !== "false");
          setBodyColumnMode(settings.body_column_mode || "single_column");
        }

        const resColors = await fetch("/api/colors?mode=all&limit=9");
        const jsonColors = await resColors.json();
        if (jsonColors.schemes) setColorPresets(jsonColors.schemes);

        const resFonts = await fetch("/api/lualatex-fonts");
        const jsonFonts = await resFonts.json();
        if (jsonFonts.success && jsonFonts.fonts) {
          const fontList = jsonFonts.fonts.map((f: any) => f.name);
          setFonts(fontList);
          if (fontList.length > 0) setSelectedFont(fontList[0]);
        }
      } catch (err) {
        console.error("Failed to load initial studio configurations:", err);
      }
    };

    loadInitialData();
  }, []);

  // Sync default font size and mode when device updates
  useEffect(() => {
    if (devices && devices[selectedDevice]) {
      setFontSize(devices[selectedDevice].font_size);
      setBodyColumnMode(devices[selectedDevice].mode || "single_column");
    }
  }, [selectedDevice, devices]);

  // Compute filtered & sorted lists (memoized)
  const filteredAndSortedFiles = useMemo(() => {
    return [...files]
      .filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "name-asc") return a.name.localeCompare(b.name);
        if (sortBy === "name-desc") return b.name.localeCompare(a.name);
        const aId = parseInt(a.name.match(/^\d+/)?.[0] || "0");
        const bId = parseInt(b.name.match(/^\d+/)?.[0] || "0");
        if (sortBy === "id-asc") return aId - bId;
        if (sortBy === "id-desc") return bId - aId;
        return 0;
      });
  }, [files, searchQuery, sortBy]);

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) =>
      prev.includes(path) ? prev.filter((f) => f !== path) : [...prev, path]
    );
  };

  const selectAllFiles = () => {
    setSelectedFiles(filteredAndSortedFiles.map((f) => f.path));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
  };

  const handleRefreshFonts = async () => {
    setIsRefreshingFonts(true);
    try {
      const res = await fetch("/api/lualatex-fonts?refresh=true");
      const json = await res.json();
      if (json.success && json.fonts) {
        const fontList = json.fonts.map((f: any) => f.name);
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
    if (!confirm("すべてのおすすめカスタム設定を初期デフォルトに戻しますか？")) return;
    try {
      const res = await fetch("/api/settings/reset", { method: "POST" });
      const data = await res.json();
      if (data.success && data.settings) {
        const settings = data.settings.global || {};
        setBgColor(settings.background_color || "#FFFFFF");
        setFgColor(settings.text_color || "#000000");
        setMainWashiEnabled(settings.main_washi_enabled === "true");
        setMainFrameEnabled(settings.main_frame_enabled === "true");
        setMainFrameVariant(settings.main_frame_variant || "1");
        setCoverTextureEnabled(settings.cover_texture_enabled === "true");
        setCoverTextureVariant(settings.cover_texture_variant || "1");
        setBackgroundRenderMode(settings.background_render_mode === "image" ? "image" : "tikz");
        setCoverImagePath(settings.cover_image_path || "");
        setWashiImagePath(settings.washi_image_path || "");
        setCoverImageOpacity(parseFloat(settings.cover_image_opacity || "0.92"));
        setWashiImageOpacity(parseFloat(settings.washi_image_opacity || "0.18"));
        setPageNumberEnabled(settings.page_number_enabled !== "false");
        setBodyColumnMode(settings.body_column_mode || "single_column");
        toast.success("設定を初期化しました。");
      }
    } catch (err) {
      console.error("Failed to reset settings:", err);
      toast.error("設定のリセットに失敗しました。");
    }
  };

  const handleCleanup = async () => {
    try {
      const res = await fetch("/api/session/cleanup-nonpdf", { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success("中間ファイルを削除しました。");
    } catch (err) {
      console.error("Failed to run cleanup:", err);
      toast.error("クリーンアップに失敗しました。");
    }
  };

  const handleStopServer = async () => {
    if (!confirm("本当にこのアプリケーションサーバーをシャットダウンしますか？")) return;
    try {
      await fetch("/api/server/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      toast.warning("サーバーを停止しました。このタブを閉じてください。");
    } catch (err) {
      console.error("Stop server command failed:", err);
      toast.error("サーバー停止コマンドに失敗しました。");
    }
  };

  return {
    files,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    selectedFiles,
    setSelectedFiles,
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
    filteredAndSortedFiles,
    toggleFile,
    selectAllFiles,
    clearAllFiles,
    handleRefreshFonts,
    handleSaveSettings,
    handleResetSettings,
    handleCleanup,
    handleStopServer,
  };
}
