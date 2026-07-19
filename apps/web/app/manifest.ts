import type { MetadataRoute } from "next";

/**
 * Web App Manifest — served at /manifest.webmanifest.
 * Drives the "Add to Home Screen" / installed-PWA experience so Union
 * launches standalone (no browser chrome) with its own icon and splash.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Union — Wedding planning",
    short_name: "Union",
    description:
      "Union plans the wedding with you — negotiates with vendors, tracks every deadline, and keeps you calm and in control.",
    id: "/",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2ECE5",
    theme_color: "#F2ECE5",
    categories: ["lifestyle", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
