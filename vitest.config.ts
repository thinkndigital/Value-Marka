import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    // "server-only" resolves to a throwing stub unless the "react-server"
    // export condition is set (that's how Next.js's RSC bundler makes it a
    // no-op); set it here too so importing our server modules under Vitest
    // behaves the same way it does in the app. Vitest resolves test files
    // through the SSR pipeline, so both fields are needed.
    conditions: ["react-server"],
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
});
