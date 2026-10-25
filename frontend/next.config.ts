import type { NextConfig } from "next";

/**
 * The browser only ever talks to this origin. `/api/v1/*` is proxied to the
 * backend service, so session cookies are first-party (no CORS, SameSite=Lax
 * works) and OAuth/email links can point at the web app's own URL.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

// The rewrite target is baked into the build. On Vercel a missing (or localhost) value would produce a site that
// builds and deploys fine but cannot reach its API, so fail the build instead. `VERCEL` is set by Vercel builds only.
if (process.env.VERCEL && process.env.NODE_ENV === "production") {
  let host = "";
  try {
    host = new URL(BACKEND_URL).hostname;
  } catch {
    // handled below
  }
  if (!process.env.BACKEND_URL || !host || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(
      "BACKEND_URL must be set to the public https URL of the API for Vercel builds (Project Settings -> Environment Variables); " +
        "it is baked into the /api/v1 rewrite, so redeploy after changing it. See docs/AUTH.md and docs/DEPLOYMENT.md.",
    );
  }
}

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Everything is same-origin: fonts are self-hosted by
 * next/font, there are no third-party scripts, images or API calls, and payment
 * providers are reached only by top-level navigation (which CSP does not block).
 * 'unsafe-inline' for scripts is required by Next's inline bootstrap scripts
 * unless a per-request nonce is used (which would make every page dynamic and
 * defeat Cache Components); it is acceptable here because no user content is
 * ever rendered as HTML (see docs/SECURITY.md). Dev additionally needs eval + websockets for HMR.
 * `upgrade-insecure-requests` is deliberately NOT set: it breaks a production build served over plain
 * http (local or staging without TLS; observed as ERR_SSL_PROTOCOL_ERROR). Production forces https with
 * the proxy's redirect plus Strict-Transport-Security below.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // The container image sets NEXT_OUTPUT=standalone; local `next start` is unaffected.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
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
          { key: "Content-Security-Policy", value: CSP },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Only meaningful over HTTPS; browsers ignore it on plain http.
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
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
