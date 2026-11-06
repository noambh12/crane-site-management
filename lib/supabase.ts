import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./supabase-config";
let client: SupabaseClient | undefined;
export function getSupabase() {
  const config = publicSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  if (!config) return null;
  client ??= createClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

