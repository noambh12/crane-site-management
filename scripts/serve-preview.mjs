// Uses the Node runtime already available in Codex. No installation, API keys or database.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(process.argv[2] ?? fileURLToPath(new URL("../out", import.meta.url)));
const port = Number(process.env.CRANEOPS_PREVIEW_PORT ?? 4173);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
createServer(async (request, response) => {
  const security = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'" };
  try {
    if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405, security); response.end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let path = resolve(root, "." + (pathname === "/" ? "/preview.html" : pathname));
    if (!path.startsWith(root + sep)) throw new Error("Invalid path");
    if (!extname(path)) path += ".html";
    if ((await stat(path)).isDirectory()) throw new Error("Not a file");
    const contentType = mime[extname(path)];
    if (!contentType) throw new Error("Unsupported file");
    response.writeHead(200, { ...security, "Content-Type": contentType });
    response.end(request.method === "HEAD" ? undefined : await readFile(path));
  } catch { response.writeHead(404, security); response.end("Not found"); }
}).listen(port, "127.0.0.1", () => console.log(`CraneOps demo preview: http://127.0.0.1:${port}/preview — sample data only, no Supabase access`));
