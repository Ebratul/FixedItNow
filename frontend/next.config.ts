import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/v1/*` is proxied to the
 * backend service, so session cookies are first-party (no CORS, SameSite=Lax
 * works) and OAuth/email links can point at the web app's own URL.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${BACKEND_URL}/api/v1/:path*` },
    ];
  },
  async headers() {
    // Baseline hardening. A Content-Security-Policy is not set yet (Next.js
    // inline scripts need a nonce-based policy); see docs/SECURITY.md.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    // Step 2 used /signup as a placeholder; registration now lives at /register.
    return [{ source: "/signup", destination: "/register", permanent: false }];
  },
};

export default nextConfig;
