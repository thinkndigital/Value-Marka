import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Product/category images: same-origin /uploads in local dev, real GCS
// bucket URLs in production (src/server/storage/gcs.ts) — both are plain
// <img> tags (not next/image), so this is what img-src needs to allow.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://storage.googleapis.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Only takes effect over HTTPS (which Cloud Run terminates at); harmless to send over local HTTP.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server bundle with only
  // the production dependencies actually used, traced from the build
  // output. This is what the Dockerfile (see DEPLOYMENT.md) copies into
  // the runtime image for Cloud Run, instead of shipping the full
  // node_modules tree.
  //
  // Deliberately *not* set on Vercel: Vercel builds its own serverless
  // functions from Next's default output-file-tracing manifests
  // (.next/server/*.nft.json) — "standalone" mode changes where/how those
  // are emitted and breaks Vercel's build step (it looks for
  // `.next/next-server.js.nft.json` and finds nothing). `VERCEL` is a env
  // var Vercel sets automatically on every build; this repo's sanctioned
  // deploy target (DEPLOYMENT.md) is Cloud Run via the Dockerfile, so this
  // only ever needs to be "standalone" there.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
