/** Only low-privilege keys may enter the browser client. Never include values in errors. */
export function publicSupabaseConfig(url?: string, key?: string) {
  if (!url || !key || url.includes("your-project")) return null;
  try {
    const parsed = new URL(url);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      parsed.pathname !== "/"
    ) return null;
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
      // Legacy anon JWTs remain supported. A service_role JWT must never be bundled.
      const parts = key.split(".");
      if (parts.length !== 3 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
      const payload = JSON.parse(atob(parts[1].replaceAll("-", "+").replaceAll("_", "/")));
      if (payload.role !== "anon") return null;
    }
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}
