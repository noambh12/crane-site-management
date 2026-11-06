import { publicSupabaseConfig } from "../lib/supabase-config.ts";
try { process.loadEnvFile(".env.local"); } catch (error) {
  if (error.code !== "ENOENT") throw new Error("Cannot read local environment file.");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// CI/setup may build without credentials. Partially configured or unsafe values fail closed.
if ((!url && !key) || (url === "https://your-project.supabase.co" && key === "your-public-publishable-key")) {
  console.log("Supabase is not configured; the application will show setup instructions.");
} else if (!publicSupabaseConfig(url, key)) {
  console.error("Unsafe or invalid public Supabase configuration. Use an HTTPS project URL and publishable/anon key. Values withheld.");
  process.exitCode = 1;
} else {
  console.log("Public Supabase configuration validated. No administrator credentials required.");
}
