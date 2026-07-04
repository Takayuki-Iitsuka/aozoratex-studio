import { NextRequest } from "next/server";
import { spawnBridge } from "@/lib/api-runner";
import { safeValidateLibraryDownloadRequest } from "@/lib/validation";

// 複数冊のダウンロードはリクエスト間スリープを含み長時間になるため、
// generate と同じ LOG:/RESULT: → SSE ストリーミング方式で進捗を返す
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const validation = safeValidateLibraryDownloadRequest(data);
    if (!validation.success) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", error: "Validation failed", details: validation.error })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" }, status: 400 }
      );
    }

    const { book_ids, overwrite } = validation.data;

    const args = ["library-download", "--book-ids", book_ids.join(",")];
    if (overwrite) {
      args.push("--overwrite");
    }

    const { process: proc, stdout } = spawnBridge(args);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let buffer = "";

        const emitLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          if (trimmed.startsWith("LOG:")) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "log", content: trimmed.substring(4) })}\n\n`
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
        };

        stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            emitLine(line);
          }
        });

        proc.stderr?.on("data", (chunk: Buffer) => {
          const errorText = chunk.toString("utf-8");
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "stderr", content: errorText })}\n\n`)
          );
        });

        proc.on("close", (code) => {
          emitLine(buffer);
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
