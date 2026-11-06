// Read-only: no signup, RPC, schema changes, or writes. Never print keys/tokens.
import { publicSupabaseConfig } from "../lib/supabase-config.ts";
try { process.loadEnvFile(".env.local"); } catch (error) {
  if (error.code !== "ENOENT") throw new Error("Cannot read local environment file.");
}
const config = publicSupabaseConfig(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
if (!config) {
  console.error("FAIL: Set a valid project URL and public publishable/anon key in .env.local. Never use administrator keys.");
  process.exit(1);
}
let failed = false;
async function check(label, path, expected) {
  try {
    const response = await fetch(config.url + path, {
      headers: { apikey: config.key }, signal: AbortSignal.timeout(15000),
    });
    const ok = expected.includes(response.status);
    console.log(`${ok ? "PASS" : "FAIL"}: ${label} (HTTP ${response.status})`);
    if (!ok) failed = true;
    if (ok && path === "/auth/v1/settings") {
      const settings = await response.json();
      console.log(`Email/password provider: ${settings.external?.email === true ? "enabled" : "disabled/unknown"}`);
      console.log(`Automatic email confirmation: ${settings.mailer_autoconfirm === true ? "ON — review before use" : "off"}`);
    }
    await response.body?.cancel().catch(() => {});
  } catch {
    failed = true;
    console.error(`FAIL: ${label} — network unavailable or timeout.`);
  }
}
await check("Supabase Auth connection", "/auth/v1/settings", [200]);
for (const table of ["companies", "memberships", "sites", "cranes", "faults", "maintenance", "activity_log"]) {
  const column = table === "memberships" ? "user_id" : "id";
  await check(`Anonymous access blocked: ${table}`, `/rest/v1/${table}?select=${column}&limit=0`, [401, 403]);
}
console.log("Authenticated cross-company and email redirect checks require verified test accounts; not performed by this read-only command.");
process.exitCode = failed ? 1 : 0;
