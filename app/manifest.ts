import type { MetadataRoute } from "next";

// Installable Studio app. Served at /manifest.webmanifest; Next links it from every page.
// Colors are the design tokens in app/globals.css (--af-wall) and the white header. Icons: scripts/gen-app-icons.mjs.
// scope "/" so links from the Studio to the artist's own page stay inside the installed app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/studio",
    name: "Artfinity Studio",
    short_name: "Artfinity",
    description: "Your Artfinity Studio: sales, QR codes, uploads and payouts, from your home screen.",
    start_url: "/studio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6ede9", // --af-wall (blush plaster)
    theme_color: "#ffffff", // the white header bar; matches the site's theme-color meta
    categories: ["business", "productivity"],
    icons: [
      { src: "/brand/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/app/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Upload art", short_name: "Upload", url: "/studio/art/new", icons: [{ src: "/brand/app/shortcut-upload.png", sizes: "96x96", type: "image/png" }] },
      { name: "QR codes", short_name: "QR codes", url: "/studio/qr", icons: [{ src: "/brand/app/shortcut-qr.png", sizes: "96x96", type: "image/png" }] },
      { name: "Money", short_name: "Money", url: "/studio/money", icons: [{ src: "/brand/app/shortcut-money.png", sizes: "96x96", type: "image/png" }] },
    ],
  };
}
