import { useState } from "react";
import { toast } from "sonner";

export interface LogEntry {
  type: "log" | "stderr" | "result" | "close" | "error";
  content: string;
}

export interface CompileOptions {
  mainWashiEnabled: boolean;
  mainFrameEnabled: boolean;
  mainFrameVariant: number;
  coverTextureEnabled: boolean;
  coverTextureVariant: number;
  backgroundRenderMode: string;
  coverImagePath: string;
  washiImagePath: string;
  coverImageOpacity: number;
  washiImageOpacity: number;
  pageNumberEnabled: boolean;
  bodyColumnMode: string;
  deviceOrientation: string;
}

export function useCompile() {
  const [compileLogs, setCompileLogs] = useState<LogEntry[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("待機中");
  const [resultAlert, setResultAlert] = useState<{
    success: boolean;
    message: string;
    pdfUrl?: string;
  } | null>(null);

  const handleCompile = async (
    targetPaths: string[],
    selectedDevice: string,
    bgColor: string,
    fgColor: string,
    selectedFont: string,
    compileOptions: CompileOptions
  ) => {
    if (targetPaths.length === 0) {
      toast.error("変換対象のHTMLファイルを選択してください。");
      return;
    }

    setIsCompiling(true);
    setCompileLogs([]);
    setResultAlert(null);
    setProgress(5);
    setProgressLabel("ビルド準備中...");

    for (let i = 0; i < targetPaths.length; i++) {
      const target = targetPaths[i];
      const percentPerFile = 90 / targetPaths.length;
      setProgress(Math.round(5 + i * percentPerFile));
      setProgressLabel(`[${i + 1}/${targetPaths.length}] ${target.split(/[/\\]/).pop()} 変換中...`);

      // Push boundary marker to logs
      setCompileLogs((prev) => [
        ...prev,
        { type: "log", content: `\n>>> [START] Processing file: ${target}\n` },
      ]);

      const payload = {
        source: target,
        device: selectedDevice,
        bg_color: bgColor,
        fg_color: fgColor,
        font_family: selectedFont,
        compile_pdf: true,
        decorations: {
          main_washi_enabled: compileOptions.mainWashiEnabled,
          main_frame_enabled: compileOptions.mainFrameEnabled,
          main_frame_variant: compileOptions.mainFrameVariant,
          cover_texture_enabled: compileOptions.coverTextureEnabled,
          cover_texture_variant: compileOptions.coverTextureVariant,
          background_render_mode: compileOptions.backgroundRenderMode,
          cover_image_path: compileOptions.coverImagePath,
          washi_image_path: compileOptions.washiImagePath,
          cover_image_opacity: compileOptions.coverImageOpacity,
          washi_image_opacity: compileOptions.washiImageOpacity,
          page_number_enabled: compileOptions.pageNumberEnabled,
          body_column_mode: compileOptions.bodyColumnMode,
          device_orientation:
            selectedDevice !== "pc" ? compileOptions.deviceOrientation : undefined,
        },
      };

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value);
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const eventData = JSON.parse(line.substring(6));
                  if (eventData.type === "log") {
                    setCompileLogs((prev) => [
                      ...prev,
                      { type: "log", content: eventData.content },
                    ]);
                  } else if (eventData.type === "stderr") {
                    setCompileLogs((prev) => [
                      ...prev,
                      { type: "stderr", content: eventData.content },
                    ]);
                  } else if (eventData.type === "result") {
                    const resPayload = eventData.data;
                    if (resPayload.success) {
                      setResultAlert({
                        success: true,
                        message: `PDFの生成に成功しました！: ${resPayload.pdf_file}`,
                        pdfUrl: resPayload.pdf_url,
                      });
                    } else {
                      setResultAlert({
                        success: false,
                        message: `生成失敗: ${resPayload.error || "コンパイルエラーが発生しました"}`,
                      });
                    }
                  }
                } catch (e) {
                  // Ignore parsing errors of raw chunks
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Compilation error:", err);
        setCompileLogs((prev) => [
          ...prev,
          { type: "error", content: `Error occurred during compile execution: ${err.message}` },
        ]);
        setResultAlert({
          success: false,
          message: `接続失敗: ${err.message}`,
        });
        break;
      }
    }

    setProgress(100);
    setProgressLabel("処理完了");
    setIsCompiling(false);
  };

  return {
    compileLogs,
    setCompileLogs,
    isCompiling,
    progress,
    setProgress,
    progressLabel,
    setProgressLabel,
    resultAlert,
    setResultAlert,
    handleCompile,
  };
}
