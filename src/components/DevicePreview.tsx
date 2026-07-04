import React from "react";

interface DevicePreviewProps {
  deviceKey: string;
  deviceLabel?: string;
  widthMm: number;
  heightMm: number;
  baseWidthMm?: number;
  baseHeightMm?: number;
  screenWidthPx?: number;
  screenHeightPx?: number;
  orientation: string;
  bgColor: string;
  fgColor: string;
  selectedFont: string;
  fontSize: number;
  sampleText: string;
}

export function DevicePreview({
  deviceKey,
  deviceLabel,
  widthMm,
  heightMm,
  baseWidthMm,
  baseHeightMm,
  screenWidthPx,
  screenHeightPx,
  orientation,
  bgColor,
  fgColor,
  selectedFont,
  fontSize,
  sampleText,
}: DevicePreviewProps) {
  // Determine portrait vs landscape dimensions
  const isLandscape = deviceKey !== "pc" && orientation === "landscape";
  const w = isLandscape ? heightMm : widthMm;
  const h = isLandscape ? widthMm : heightMm;

  // Calculate box scale
  const scale = 250 / Math.max(w, h);
  const widthPx = w * scale;
  const heightPx = h * scale;
  const displayName = deviceLabel || deviceKey;
  const baseSizeLabel =
    baseWidthMm && baseHeightMm ? `${baseWidthMm} × ${baseHeightMm} mm` : `${widthMm} × ${heightMm} mm`;
  const screenSizeLabel =
    screenWidthPx && screenHeightPx ? `${screenWidthPx} × ${screenHeightPx} px` : "未設定";
  const previewFontSizePx = Math.max(15, Math.min(20, fontSize + 4));

  const fontStyle = {
    backgroundColor: bgColor,
    color: fgColor,
    fontFamily: selectedFont ? `"${selectedFont}", serif` : "serif",
    fontSize: `${previewFontSizePx}px`,
  };

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            出力確認プレビュー
          </h2>
          <p className="text-xs text-muted-foreground">
            設定ページとPDF生成ページの選択状態を反映しています。
          </p>
        </div>
      </div>

      {/* Aspect Ratio Box Preview */}
      <div className="bg-muted/40 border border-border rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
        <div
          className="border-[3px] border-black/15 rounded-2xl flex flex-col items-center justify-center p-4 text-center shadow-2xl relative transition-all duration-300"
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            backgroundColor: bgColor,
            color: fgColor,
          }}
        >
          {/* Simulated spine boundary */}
          <div className="absolute top-0 bottom-0 left-0 w-3 bg-black/10 border-r border-black/5 rounded-l-2xl" />

          <div className="z-10 tategaki select-none flex flex-col items-center justify-center h-full" style={{ fontFamily: selectedFont ? `"${selectedFont}", serif` : "serif" }}>
            <div className="font-bold text-sm sm:text-base leading-relaxed tracking-[1px]">
              蜘蛛の糸
            </div>
            <div className="mt-2 text-[10px] sm:text-xs opacity-80 tracking-[0.5px]">
              芥川龍之介
            </div>
          </div>
        </div>

        <span className="absolute bottom-3 right-4 text-[10px] text-muted-foreground font-mono bg-card/70 px-1.5 rounded-sm">
          {scale.toFixed(1)} px/mm
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1">
          <div className="text-muted-foreground">出力デバイス</div>
          <div className="font-semibold text-foreground">{displayName}</div>
          <div className="font-mono text-muted-foreground">{deviceKey}</div>
        </div>
        <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1">
          <div className="text-muted-foreground">画面サイズ</div>
          <div className="font-semibold text-foreground">{screenSizeLabel}</div>
          <div className="text-muted-foreground">device config</div>
        </div>
        <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1">
          <div className="text-muted-foreground">用紙サイズ</div>
          <div className="font-semibold text-foreground">
            {w} × {h} mm
          </div>
          <div className="text-muted-foreground">基準: {baseSizeLabel}</div>
        </div>
        <div className="rounded-xl border border-border bg-input/40 p-3 space-y-1">
          <div className="text-muted-foreground">フォントサイズ</div>
          <div className="font-semibold text-foreground">{fontSize} pt</div>
          <div className="text-muted-foreground">確認表示: {previewFontSizePx}px</div>
        </div>
      </div>

      {/* 文字化けテスト（プレビュー） */}
      <div className="space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground font-semibold">
          <span>文字化けテスト（プレビュー）</span>
          <span className="font-mono">FONT: {selectedFont || "Default"}</span>
        </div>
        <div
          className="w-full h-72 p-5 font-serif border border-border rounded-xl overflow-auto tategaki leading-relaxed select-none"
          style={fontStyle}
        >
          {sampleText}
        </div>
      </div>
    </section>
  );
}
