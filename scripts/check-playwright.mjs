// Fail early on image/package drift or missing system libraries. Never download a browser.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
const require = createRequire(import.meta.url);
const installed = require("@playwright/test/package.json").version;
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const lock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
);
assert.equal(
  installed,
  process.env.PLAYWRIGHT_IMAGE_VERSION,
  "Docker image and installed Playwright versions must match",
);
assert.equal(
  manifest.devDependencies["@playwright/test"],
  installed,
  "Pin @playwright/test exactly to the Docker image version",
);
assert.equal(
  lock.packages["node_modules/@playwright/test"].version,
  installed,
  "Lockfile must match the Docker image",
);
const executable = chromium.executablePath();
assert.ok(
  existsSync(executable),
  `Preinstalled Chromium missing: ${executable}`,
);
console.log(`Playwright ${installed}; preinstalled executable: ${executable}`);
const browser = await chromium.launch({ timeout: 30000 });
try {
  console.log(
    `Chromium ${browser.version()} launched successfully without apt or browser downloads.`,
  );
} finally {
  await browser.close();
}
