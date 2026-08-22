import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Value Marka",
    short_name: "Value Marka",
    description: "A multi-vendor marketplace built on trust, value, and scale.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f8",
    theme_color: "#333e48",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
