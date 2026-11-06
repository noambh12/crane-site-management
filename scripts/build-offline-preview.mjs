import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const result = await build({
  entryPoints: ["preview/entry.tsx"], bundle: true, write: false,
  minify: true, format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_SUPABASE_URL": '""', "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""' },
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = (await readFile("app/globals.css", "utf8")).replace('@import "tailwindcss";', "");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'"><title>CraneOps — Demo preview</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
await mkdir("preview-dist", { recursive: true });
await writeFile("preview-dist/CraneOps-preview.html", html);
console.log("Offline CraneOps demo built: preview-dist/CraneOps-preview.html (no network access)");
