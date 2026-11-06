import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publicSupabaseConfig } from "../lib/supabase-config.ts";
const url = "https://example.supabase.co";
const key = "sb_publishable_test";
const jwt = (role) => `e30.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
test("accepts publishable keys and legacy anon keys", () => {
  assert.deepEqual(publicSupabaseConfig(url, key), { url, key });
  assert.ok(publicSupabaseConfig(url, jwt("anon")));
});
test("rejects privileged keys and invalid/missing values", () => {
  for (const value of [undefined, "", "sb_secret_test", jwt("service_role"), jwt("authenticated"), "invalid", "sb_publishable_bad key"]) {
    assert.equal(publicSupabaseConfig(url, value), null);
  }
  assert.equal(publicSupabaseConfig(undefined, key), null);
});
test("requires HTTPS except for local loopback and rejects URL credentials", () => {
  for (const value of ["http://example.supabase.co", "https://user:pass@example.supabase.co", "https://example.supabase.co?token=abc", "https://example.supabase.co/path", "https://example.supabase.co#fragment", "not-a-url"]) {
    assert.equal(publicSupabaseConfig(value, key), null);
  }
  assert.ok(publicSupabaseConfig("http://127.0.0.1:54321", key));
});
test("startup/build preflight rejects privileged keys without printing them", () => {
  for (const value of ["sb_secret_do-not-print", jwt("service_role")]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/validate-env.mjs", import.meta.url))], {
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: value },
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.ok(!`${result.stdout}${result.stderr}`.includes(value));
  }
});
test("production preflight checks production overrides before .env.local", () => {
  const directory = mkdtempSync(join(tmpdir(), "craneops-env-"));
  const secret = "sb_secret_test-only";
  try {
    writeFileSync(join(directory, ".env.local"), `NEXT_PUBLIC_SUPABASE_URL=${url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\n`);
    writeFileSync(join(directory, ".env.production.local"), `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${secret}\n`);
    const env = { ...process.env };
    delete env.NEXT_PUBLIC_SUPABASE_URL;
    delete env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const script = fileURLToPath(new URL("../scripts/validate-env.mjs", import.meta.url));
    const production = spawnSync(process.execPath, [script, "production"], { env, cwd: directory, encoding: "utf8" });
    assert.equal(production.status, 1);
    assert.ok(!`${production.stdout}${production.stderr}`.includes(secret));
    const development = spawnSync(process.execPath, [script, "development"], { env, cwd: directory, encoding: "utf8" });
    assert.equal(development.status, 0);
  } finally {
    unlinkSync(join(directory, ".env.local"));
    unlinkSync(join(directory, ".env.production.local"));
    rmdirSync(directory);
  }
});
