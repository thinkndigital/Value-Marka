import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Every locale is prefixed (routing.ts localePrefix: "always"), so
        // these cover both /en/... and /ar/... — no per-locale disallow
        // list needed. Account/checkout/admin/seller are all behind auth
        // anyway (proxy.ts), but keeping crawlers out of them too avoids
        // wasting crawl budget on pages that would just redirect to login.
        disallow: ["/*/account", "/*/checkout", "/*/admin", "/*/seller", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
