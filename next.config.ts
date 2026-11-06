import type { NextConfig } from "next";
const config: NextConfig = {
  ...(process.env.CRANEOPS_STATIC_PREVIEW === "1" ? { output: "export" as const } : {}),
  poweredByHeader: false,
  distDir: process.env.CRANEOPS_TEST_DIST_DIR ?? ".next",
  async headers() {
    if (process.env.CRANEOPS_STATIC_PREVIEW === "1") return [];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;

