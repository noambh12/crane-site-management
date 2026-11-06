// Portable transport of the public, credential-free static preview through the connected build API.
// Only allowlisted build assets and the loopback server are included. No source env files.
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.isFile() && /\.(html|js|css|txt|json|ico|svg|woff2)$/.test(path)) files.push({ path, content: (await readFile(path)).toString("base64") });
  }
  return files;
}
const files = await collect("out");
files.push({ path: "scripts/serve-preview.mjs", content: (await readFile("scripts/serve-preview.mjs")).toString("base64") });
const buffer = gzipSync(Buffer.from(JSON.stringify(files)));
if (buffer.length > 2_000_000) throw new Error("Preview bundle exceeds transport limit");
const encoded = buffer.toString("base64");
console.log(`CRANEOPS_PREVIEW_SHA256 ${createHash("sha256").update(buffer).digest("hex")}`);
for (let i = 0; i < encoded.length; i += 8000) console.log(`CRANEOPS_PREVIEW_CHUNK ${String(i / 8000).padStart(4, "0")} ${encoded.slice(i, i + 8000)}`);
console.log(`CRANEOPS_PREVIEW_END ${files.length}`);
