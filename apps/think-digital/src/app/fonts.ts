import { Alexandria, IBM_Plex_Sans_Arabic, Inter, Inter_Tight } from "next/font/google";

// PROVISIONAL typefaces until Think Digital's brand fonts are confirmed.
// Latin fonts load only the latin subset and Arabic fonts only the arabic
// subset, so each glyph resolves to exactly one family in the shared stacks
// defined in src/styles/tokens/type.css.
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const alexandria = Alexandria({
  subsets: ["arabic"],
  variable: "--font-alexandria",
  display: "swap",
});

export const fontVariables = [inter, interTight, plexArabic, alexandria]
  .map((f) => f.variable)
  .join(" ");
