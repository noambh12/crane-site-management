import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 3000 --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000",
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 3001 --hostname 127.0.0.1",
      url: "http://127.0.0.1:3001",
      env: {
        CRANEOPS_TEST_DIST_DIR: ".next-auth-test",
        NEXT_PUBLIC_SUPABASE_URL: "https://craneops-tests.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-placeholder",
      },
      reuseExistingServer: false,
    },
  ],
});
