import { defineRouting } from "next-intl/routing";

// The launch language set (spec §6). Adding a language later is a change to
// this array plus a messages/<locale>.json file and Language table seed row
// — no route restructuring required.
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
