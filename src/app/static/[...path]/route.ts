import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  const relativePathList = params.path;
  const filePath = path.join(process.cwd(), "static", ...relativePathList);

  // Prevent directory traversal attacks
  const resolvedBase = path.resolve(path.join(process.cwd(), "static"));
  const resolvedTarget = path.resolve(filePath);
  if (!resolvedTarget.startsWith(resolvedBase)) {
    return new Response("Access Denied", { status: 403 });
  }

  if (!fs.existsSync(resolvedTarget)) {
    return new Response("Not Found", { status: 404 });
  }

  const stat = fs.statSync(resolvedTarget);
  if (!stat.isFile()) {
    return new Response("Forbidden", { status: 403 });
  }

  const fileStream = fs.readFileSync(resolvedTarget);

  let contentType = "application/octet-stream";
  const ext = path.extname(resolvedTarget).toLowerCase();
  if (ext === ".pdf") contentType = "application/pdf";
  else if (ext === ".html") contentType = "text/html";
  else if (ext === ".css") contentType = "text/css";
  else if (ext === ".js") contentType = "application/javascript";
  else if (ext === ".png") contentType = "image/png";
  else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
  else if (ext === ".webp") contentType = "image/webp";
  else if (ext === ".svg") contentType = "image/svg+xml";

  return new Response(fileStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": stat.size.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
