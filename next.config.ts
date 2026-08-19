import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server bundle with only
  // the production dependencies actually used, traced from the build
  // output. This is what the Dockerfile (see DEPLOYMENT.md) copies into
  // the runtime image for Cloud Run, instead of shipping the full
  // node_modules tree.
  output: "standalone",
};

export default withNextIntl(nextConfig);
