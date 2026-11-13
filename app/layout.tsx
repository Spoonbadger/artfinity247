import { ReactNode } from "react";
import { type Metadata, type Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import Provider from "@/components/contexts";
import BrushDefs from "@/components/af/BrushDefs";
import PwaSetup from "@/components/pwa/PwaSetup";
import SkipLink from "@/components/a11y/SkipLink";
import "./globals.css";

// Bundled in /fonts (see fonts/README.md) so the build never downloads from Google Fonts.
// Bricolage Grotesque is variable: weight 200-800 plus the wdth and opsz axes.
const display = localFont({
  src: "../fonts/bricolage-grotesque-200-800.woff2",
  weight: "200 800",
  variable: "--font-display",
  display: "swap",
});
const body = localFont({
  src: "../fonts/instrument-sans-400-700.woff2",
  weight: "400 700",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Artfinity · From paint to print", template: "%s · Artfinity" },
  description:
    "Artists upload their work free, print a QR code to hang beside it, and get paid when people scan it and buy a print.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com"),
  // Opt out of AI training. Pages that set their own robots (admin, studio) replace this.
  robots: "noai, noimageai",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Installable Studio app (app/manifest.ts): iOS home-screen name and full-screen launch.
  appleWebApp: { capable: true, title: "Artfinity", statusBarStyle: "default" },
  openGraph: {
    siteName: "Artfinity",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "Artfinity. From paint to print." }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/og-image.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <html lang="en">
      <body className={cn("font-body", display.variable, body.variable)}>
        <SkipLink />
        <BrushDefs />
        <Provider>{children}</Provider>
        <Toaster position="top-center" richColors />
        <PwaSetup />
      </body>
    </html>
  );
};

export default RootLayout;
