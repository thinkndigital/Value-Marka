"use client";

import { useEffect } from "react";

// Root-level catch-all (Next.js file convention: only fires when an error
// escapes every nested error.tsx, including one in the root layout itself)
// — it replaces the entire document, so it renders its own <html>/<body>
// rather than relying on src/app/[locale]/layout.tsx. Client-side errors
// reaching this boundary are logged from the browser; server-side errors
// are already logged by src/instrumentation.ts's onRequestError.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(JSON.stringify({ severity: "ERROR", message: error.message, digest: error.digest }));
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: "#666" }}>
            We hit an unexpected error. Please try reloading the page.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- global-error replaces the root layout entirely; next-intl's Link/locale context may not be available here. */}
          <a
            href="/"
            style={{
              borderRadius: "6px",
              backgroundColor: "#facc15",
              padding: "0.625rem 1.25rem",
              fontWeight: 600,
              color: "#1a1a1a",
              textDecoration: "none",
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
