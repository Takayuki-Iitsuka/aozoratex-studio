import React from "react";

interface DevicePreviewProps {
  deviceKey: string;
  widthMm: number;
  heightMm: number;
  orientation: string;
  bgColor: string;
  fgColor: string;
  selectedFont: string;
  sampleText: string;
}

export function DevicePreview({
  deviceKey,
  widthMm,
  heightMm,
  orientation,
  bgColor,
  fgColor,
  selectedFont,
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

  return (
    <section className="rounded-2xl border border-white/5 bg-zinc-900/60 p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            出力確認プレビュー
          </h2>
        </div>
      </div>

      {/* Aspect Ratio Box Preview */}
      <div className="bg-zinc-950/80 border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
        <div
          className="bg-white border-[3px] border-zinc-300/90 rounded-2xl flex flex-col items-center justify-center p-4 text-center shadow-2xl relative transition-all duration-300"
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            backgroundColor: bgColor,
            color: fgColor,
          }}
        >
          {/* Simulated spine boundary */}
          <div className="absolute top-0 bottom-0 left-0 w-3 bg-black/10 border-r border-black/5 rounded-l-2xl" />

          <div className="text-center font-serif text-[10px] sm:text-xs leading-relaxed z-10 tategaki select-none font-semibold tracking-[0.5px]">
            <div className="uppercase opacity-80">{deviceKey} プレビュー</div>
            <div className="mt-1.5 text-[9px] opacity-70 tabular-nums">
              {w} × {h} mm
            </div>
          </div>
        </div>

        <span className="absolute bottom-3 right-4 text-[10px] text-zinc-500 font-mono bg-zinc-950/60 px-1.5 rounded">
          {scale.toFixed(1)} px/mm
        </span>
      </div>

      {/* Live Text wrap Preview */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
          <span>文字化けテスト（縦書きプレビュー）</span>
          <span className="font-mono">FONT: {selectedFont || "Default"}</span>
        </div>
        <textarea
          readOnly
          value={sampleText}
          className="w-full h-44 p-4 text-xs font-serif bg-white text-black border border-white/5 rounded-xl resize-none outline-none leading-relaxed select-none"
          style={{
            backgroundColor: bgColor,
            color: fgColor,
            fontFamily: selectedFont ? `"${selectedFont}", serif` : "serif",
          }}
        />
      </div>
    </section>
  );
}
