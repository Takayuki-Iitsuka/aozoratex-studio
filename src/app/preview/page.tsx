"use client";

import React from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";

import { DevicePreview } from "@/components/DevicePreview";
import { StepCard } from "@/components/StepCard";
import { useSettings } from "@/lib/contexts/SettingsContext";
import { PREVIEW_SAMPLE_TEXT } from "@/lib/preview-sample";

export default function PreviewPage() {
  const settings = useSettings();
  const activeDevice = settings.devices[settings.selectedDevice];
  const widthMm = activeDevice?.base_width || activeDevice?.width_mm || 100;
  const heightMm = activeDevice?.base_height || activeDevice?.height_mm || 100;
  const isLandscape = settings.selectedDevice !== "pc" && settings.deviceOrientation === "landscape";
  const displayWidthMm = isLandscape ? heightMm : widthMm;
  const displayHeightMm = isLandscape ? widthMm : heightMm;
  const screenSizeLabel =
    activeDevice?.width && activeDevice?.height
      ? `${activeDevice.width} x ${activeDevice.height} px`
      : "未設定";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight">出力確認プレビュー</h1>
        <p className="text-sm text-muted-foreground">
          現在のデバイス・配色・フォント設定で、PDF の見え方を確認します。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
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
        </div>

        <div className="lg:col-span-4">
          <StepCard
            title="プレビュー設定"
            description="表示内容は設定ページとPDF生成ページの選択状態を反映します。"
            icon={<Settings2 size={18} />}
          >
            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1">
                <div className="text-muted-foreground">出力デバイス</div>
                <div className="font-semibold text-foreground capitalize">
                  {activeDevice?.label || settings.selectedDevice}
                </div>
                <div className="text-muted-foreground">
                  {displayWidthMm} x {displayHeightMm} mm / {settings.deviceOrientation}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1">
                <div className="text-muted-foreground">画面サイズ</div>
                <div className="font-semibold text-foreground">{screenSizeLabel}</div>
              </div>
              <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1">
                <div className="text-muted-foreground">フォント</div>
                <div className="font-semibold text-foreground truncate">
                  {settings.selectedFont || "未読み込み"}
                </div>
                <div className="text-muted-foreground">{settings.fontSize} pt</div>
              </div>
              <Link
                href="/settings"
                className="w-full px-3 py-2 text-xs font-semibold bg-muted hover:bg-muted/70 text-foreground border border-border rounded-xl transition inline-flex justify-center"
              >
                設定を変更する
              </Link>
            </div>
          </StepCard>
        </div>
      </div>
    </div>
  );
}
