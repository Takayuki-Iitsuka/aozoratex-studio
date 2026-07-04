import { NextRequest } from "next/server";
import { spawnGenerator } from "@/lib/api-runner";
import { safeValidateCompileRequest } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Zod による入力バリデーション (提案実装)
    const validation = safeValidateCompileRequest(data);
    if (!validation.success) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", error: "Validation failed", details: validation.error })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" }, status: 400 }
      );
    }

    const { source, device, bg_color, fg_color, font_family, compile_pdf, decorations } = data;

    const args = [
      "--source",
      source,
      "--device",
      device,
      "--bg-color",
      bg_color,
      "--fg-color",
      fg_color,
    ];

    if (font_family) {
      args.push("--font-family", font_family);
    }
    if (compile_pdf === false || compile_pdf === "false") {
      args.push("--compile-pdf", "false");
    }
    if (decorations) {
      args.push("--decorations-json", JSON.stringify(decorations));
    }

    const { process: proc, stdout } = spawnGenerator(args);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let buffer = "";

        stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith("LOG:")) {
              const logContent = trimmed.substring(4);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "log", content: logContent })}\n\n`)
              );
            } else if (trimmed.startsWith("RESULT:")) {
              const resultJson = trimmed.substring(7);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "result",
                    data: JSON.parse(resultJson),
                  })}\n\n`
                )
              );
            }
          }
        });

        proc.stderr?.on("data", (chunk: Buffer) => {
          const errorText = chunk.toString("utf-8");
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "stderr", content: errorText })}\n\n`)
          );
        });

        proc.on("close", (code) => {
          // Process remaining content in buffer
          if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith("LOG:")) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "log",
                    content: trimmed.substring(4),
                  })}\n\n`
                )
              );
            } else if (trimmed.startsWith("RESULT:")) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "result",
                    data: JSON.parse(trimmed.substring(7)),
                  })}\n\n`
                )
              );
            }
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "close", code })}\n\n`)
          );
          controller.close();
        });
      },
      cancel() {
        proc.kill();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
      },
    });
  }
}
