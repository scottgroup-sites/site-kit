import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileForUrl } from "./pages.js";

const UTF8 = "; charset=utf-8";
const TYPES = {
  ".html": "text/html" + UTF8, ".css": "text/css" + UTF8, ".js": "text/javascript" + UTF8, ".mjs": "text/javascript" + UTF8, ".json": "application/json" + UTF8,
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif",
  ".gif": "image/gif", ".svg": "image/svg+xml" + UTF8, ".ico": "image/x-icon", ".xml": "application/xml" + UTF8,
  ".txt": "text/plain" + UTF8, ".pdf": "application/pdf", ".woff2": "font/woff2",
};

export async function serveSite(outDir) {
  const server = createServer((req, res) => {
    const file = fileForUrl(outDir, req.url);
    const root = resolve(outDir);
    const inside = resolve(file).startsWith(root + sep);
    if (inside && existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
      res.end(readFileSync(file));
      return;
    }
    const notFound = join(outDir, "404.html");
    res.writeHead(404, { "Content-Type": TYPES[".html"] });
    res.end(existsSync(notFound) ? readFileSync(notFound) : "Not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
