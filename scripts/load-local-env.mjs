// Match Next's file precedence without printing configuration values.
export function loadLocalEnv(mode = "development") {
  const files = [`.env.${mode}.local`, ...(mode === "test" ? [] : [".env.local"]), `.env.${mode}`, ".env"];
  for (const file of files) {
    try { process.loadEnvFile(file); } catch (error) {
      if (error.code !== "ENOENT") throw new Error("Cannot read local environment configuration.");
    }
  }
}
