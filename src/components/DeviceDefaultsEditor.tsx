"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Smartphone,
  Tablet,
  Monitor,
  Save,
  RotateCcw,
  FileText,
  Copy,
  ExternalLink,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// 数値フィールド（入力中の空欄を許容するため文字列で保持し、保存時にそのまま送る。
// 値の解釈・検証はバックエンドの settings_store が行う）
const NUMERIC_KEYS = [
  "font_size",
  "width_mm",
  "height_mm",
  "margin_top_mm",
  "margin_bottom_mm",
  "margin_left_mm",
  "margin_right_mm",
  "line_gap_ratio",
  "line_leading_ratio",
  "character_spacing_zw",
] as const;
type NumericKey = (typeof NUMERIC_KEYS)[number];

interface DeviceDefaultPayload {
  mode: string;
  orientation: string;
  show_page_number: boolean;
  label: string;
  category: string;
  supports_orientation: boolean;
  supports_columns: boolean;
  [key: string]: unknown;
}

interface EditableProfile {
  values: Record<NumericKey, string>;
  mode: string;
  orientation: string;
  show_page_number: boolean;
  label: string;
  category: string;
  supports_orientation: boolean;
  supports_columns: boolean;
}

type EditableProfiles = Record<string, EditableProfile>;

// 初期値ファイルの場所情報（GET /api/device-defaults の config_file）
interface ConfigFileInfo {
  path: string;
  directory: string;
  filename: string;
}

// 外部エディタ起動ボタンの定義（app はサーバー側の許可リストと一致させる）
const OPEN_EDITOR_ACTIONS: Array<{
  app: "notepad" | "default" | "vscode" | "explorer";
  label: string;
  icon: React.ReactNode;
}> = [
  { app: "notepad", label: "メモ帳で開く", icon: <FileText size={13} /> },
  { app: "default", label: "既定のエディタで開く", icon: <ExternalLink size={13} /> },
  { app: "vscode", label: "VS Code で開く", icon: <ExternalLink size={13} /> },
  { app: "explorer", label: "フォルダーを開く", icon: <FolderOpen size={13} /> },
];

const CATEGORY_GROUPS = [
  { id: "smartphone", label: "スマートフォン", icon: <Smartphone size={13} /> },
  { id: "tablet", label: "タブレット", icon: <Tablet size={13} /> },
  { id: "pc", label: "PC", icon: <Monitor size={13} /> },
];

function toEditableProfiles(devices: Record<string, DeviceDefaultPayload>): EditableProfiles {
  const result: EditableProfiles = {};
  Object.entries(devices).forEach(([deviceKey, payload]) => {
    const values = {} as Record<NumericKey, string>;
    NUMERIC_KEYS.forEach((key) => {
      values[key] = String(payload[key] ?? "");
    });
    result[deviceKey] = {
      values,
      mode: payload.mode,
      orientation: payload.orientation,
      show_page_number: payload.show_page_number,
      label: payload.label,
      category: payload.category,
      supports_orientation: payload.supports_orientation,
      supports_columns: payload.supports_columns,
    };
  });
  return result;
}

function toRequestPayload(profiles: EditableProfiles): Record<string, Record<string, string>> {
  const payload: Record<string, Record<string, string>> = {};
  Object.entries(profiles).forEach(([deviceKey, profile]) => {
    const entry: Record<string, string> = {
      mode: profile.mode,
      orientation: profile.orientation,
      show_page_number: String(profile.show_page_number),
    };
    NUMERIC_KEYS.forEach((key) => {
      entry[key] = profile.values[key];
    });
    payload[deviceKey] = entry;
  });
  return payload;
}

export function DeviceDefaultsEditor({ onSaved }: { onSaved?: () => void | Promise<void> }) {
  const [profiles, setProfiles] = useState<EditableProfiles | null>(null);
  const [configFile, setConfigFile] = useState<ConfigFileInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const loadProfiles = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/device-defaults");
      const json = await res.json();
      if (json.success && json.devices) {
        setProfiles(toEditableProfiles(json.devices));
        if (json.config_file?.path) {
          setConfigFile(json.config_file as ConfigFileInfo);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to load device defaults:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    loadProfiles().then((ok) => {
      if (!ok) setLoadError(true);
    });
  }, [loadProfiles]);

  const updateNumeric = (deviceKey: string, key: NumericKey, value: string) => {
    setProfiles((prev) => {
      if (!prev) return prev;
      const profile = prev[deviceKey];
      return {
        ...prev,
        [deviceKey]: { ...profile, values: { ...profile.values, [key]: value } },
      };
    });
  };

  const updateField = (
    deviceKey: string,
    patch: Partial<Pick<EditableProfile, "mode" | "orientation" | "show_page_number">>
  ) => {
    setProfiles((prev) => {
      if (!prev) return prev;
      return { ...prev, [deviceKey]: { ...prev[deviceKey], ...patch } };
    });
  };

  const handleSave = async () => {
    if (!profiles) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/device-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toRequestPayload(profiles)),
      });
      const json = await res.json();
      if (json.success && json.devices) {
        setProfiles(toEditableProfiles(json.devices));
        toast.success("端末の初期値を保存しました。");
        await onSaved?.();
      } else {
        toast.error("初期値の保存に失敗しました。");
      }
    } catch (err) {
      console.error("Failed to save device defaults:", err);
      toast.error("初期値の保存に失敗しました。");
    } finally {
      setIsBusy(false);
    }
  };

  const handleFactoryReset = async () => {
    if (!confirm("すべての端末の初期値を工場出荷値（プログラム組み込みの既定値）に戻しますか？")) {
      return;
    }
    setIsBusy(true);
    try {
      const res = await fetch("/api/device-defaults/reset", { method: "POST" });
      const json = await res.json();
      if (json.success && json.devices) {
        setProfiles(toEditableProfiles(json.devices));
        toast.success("端末の初期値を工場出荷値に戻しました。");
        await onSaved?.();
      } else {
        toast.error("工場出荷値への復元に失敗しました。");
      }
    } catch (err) {
      console.error("Failed to reset device defaults:", err);
      toast.error("工場出荷値への復元に失敗しました。");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyPath = async () => {
    if (!configFile) return;
    try {
      await navigator.clipboard.writeText(configFile.path);
      toast.success("設定ファイルのパスをコピーしました。");
    } catch (err) {
      console.error("Failed to copy config path:", err);
      toast.error("パスのコピーに失敗しました。");
    }
  };

  const handleOpenIn = async (app: (typeof OPEN_EDITOR_ACTIONS)[number]["app"]) => {
    try {
      const res = await fetch("/api/device-defaults/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("設定ファイルを開きました。編集後は「ファイルから再読込」を押してください。");
      } else {
        toast.error(json.error || "設定ファイルを開けませんでした。");
      }
    } catch (err) {
      console.error("Failed to open config file:", err);
      toast.error("設定ファイルを開けませんでした。");
    }
  };

  const handleReloadFromFile = async () => {
    setIsBusy(true);
    const ok = await loadProfiles();
    setIsBusy(false);
    if (ok) {
      toast.success("設定ファイルから初期値を再読込しました。");
    } else {
      toast.error("設定ファイルの再読込に失敗しました。");
    }
  };

  if (loadError) {
    return <div className="text-xs text-muted-foreground">端末初期値の読み込みに失敗しました。</div>;
  }
  if (!profiles) {
    return <div className="text-xs text-muted-foreground">端末初期値を読み込み中...</div>;
  }

  const numberInputClass =
    "w-16 px-2 py-1 text-xs bg-input border border-border rounded-lg text-foreground text-center focus:outline-hidden focus:border-accent transition disabled:opacity-50";
  const selectClass =
    "px-2 py-1 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-hidden focus:border-accent transition disabled:opacity-50";

  const renderNumberCell = (deviceKey: string, key: NumericKey, step: string) => (
    <td className="px-2 py-2 text-center">
      <input
        type="number"
        step={step}
        value={profiles[deviceKey].values[key]}
        onChange={(e) => updateNumeric(deviceKey, key, e.target.value)}
        className={numberInputClass}
      />
    </td>
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">端末</th>
              <th className="px-2 py-2.5 font-semibold">文字 (pt)</th>
              <th className="px-2 py-2.5 font-semibold">幅 (mm)</th>
              <th className="px-2 py-2.5 font-semibold">高さ (mm)</th>
              <th className="px-2 py-2.5 font-semibold">余白上 (mm)</th>
              <th className="px-2 py-2.5 font-semibold">余白下 (mm)</th>
              <th className="px-2 py-2.5 font-semibold">余白左 (mm)</th>
              <th className="px-2 py-2.5 font-semibold">余白右 (mm)</th>
              <th className="px-2 py-2.5 font-semibold">向き</th>
              <th className="px-2 py-2.5 font-semibold">段組</th>
              <th className="px-2 py-2.5 font-semibold">頁番号</th>
              <th className="px-2 py-2.5 font-semibold">行間比</th>
              <th className="px-2 py-2.5 font-semibold">行送り比</th>
              <th className="px-2 py-2.5 font-semibold">字間 (zw)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {CATEGORY_GROUPS.map((group) => {
              const entries = Object.entries(profiles).filter(
                ([, profile]) => profile.category === group.id
              );
              if (entries.length === 0) return null;
              return (
                <React.Fragment key={group.id}>
                  <tr className="bg-input/40">
                    <td colSpan={14} className="px-3 py-2">
                      <span className="flex items-center gap-1.5 text-muted-foreground font-semibold uppercase tracking-wider">
                        {group.icon}
                        {group.label}
                      </span>
                    </td>
                  </tr>
                  {entries.map(([deviceKey, profile]) => (
                    <tr key={deviceKey} className="bg-input/10">
                      <td className="px-3 py-2 font-semibold text-foreground/90">
                        {profile.label || deviceKey}
                      </td>
                      {renderNumberCell(deviceKey, "font_size", "0.1")}
                      {renderNumberCell(deviceKey, "width_mm", "1")}
                      {renderNumberCell(deviceKey, "height_mm", "1")}
                      {renderNumberCell(deviceKey, "margin_top_mm", "0.5")}
                      {renderNumberCell(deviceKey, "margin_bottom_mm", "0.5")}
                      {renderNumberCell(deviceKey, "margin_left_mm", "0.5")}
                      {renderNumberCell(deviceKey, "margin_right_mm", "0.5")}
                      <td className="px-2 py-2 text-center">
                        <select
                          value={profile.orientation}
                          onChange={(e) => updateField(deviceKey, { orientation: e.target.value })}
                          disabled={!profile.supports_orientation}
                          className={selectClass}
                        >
                          <option value="portrait">縦向き</option>
                          <option value="landscape">横向き</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select
                          value={profile.mode}
                          onChange={(e) => updateField(deviceKey, { mode: e.target.value })}
                          disabled={!profile.supports_columns}
                          className={selectClass}
                        >
                          <option value="single_column">一段組</option>
                          <option value="two_column">二段組</option>
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={profile.show_page_number}
                          onChange={(e) =>
                            updateField(deviceKey, { show_page_number: e.target.checked })
                          }
                          disabled={profile.category === "smartphone"}
                          className="accent-[--color-accent] disabled:opacity-50"
                        />
                      </td>
                      {renderNumberCell(deviceKey, "line_gap_ratio", "0.05")}
                      {renderNumberCell(deviceKey, "line_leading_ratio", "0.05")}
                      {renderNumberCell(deviceKey, "character_spacing_zw", "0.05")}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        スマートフォンは仕様上、常に縦向き・一段組・ページ番号なしで出力されます。<br />
        ここでの保存は下記の初期値ファイルを書き換えます。ファイルが無い場合は自動作成されます。
      </p>

      {/* 設定ファイルの場所と外部エディタ起動 */}
      <div className="rounded-xl border border-border bg-input/40 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          <FileText size={13} />
          設定ファイル（初期値の保存先）
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <code className="flex-1 px-3 py-2 text-xs bg-input border border-border rounded-lg text-foreground/90 font-mono break-all select-all">
            {configFile ? configFile.path : "パスを取得中..."}
          </code>
          <button
            onClick={handleCopyPath}
            disabled={!configFile}
            className="shrink-0 py-2 px-3 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Copy size={13} />
            パスをコピー
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          このファイルは INI 形式のテキストです。メモ帳やお好みのエディタ・IDE（VS Code など）で直接編集できます。
          外部で編集・保存した後は「ファイルから再読込」を押すと上の一覧に反映されます。
        </p>

        <div className="flex flex-wrap gap-2">
          {OPEN_EDITOR_ACTIONS.map((action) => (
            <button
              key={action.app}
              onClick={() => handleOpenIn(action.app)}
              className="py-2 px-3 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-lg transition flex items-center justify-center gap-1.5"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
          <button
            onClick={handleReloadFromFile}
            disabled={isBusy}
            className="py-2 px-3 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isBusy ? "animate-spin" : ""} />
            ファイルから再読込
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          onClick={handleSave}
          disabled={isBusy}
          className="py-2.5 px-4 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <Save size={14} />
          初期値を保存する
        </button>
        <button
          onClick={handleFactoryReset}
          disabled={isBusy}
          className="py-2.5 px-4 text-xs font-semibold bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <RotateCcw size={14} />
          工場出荷値に戻す
        </button>
      </div>
    </div>
  );
}
