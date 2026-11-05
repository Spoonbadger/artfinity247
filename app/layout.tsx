import { ReactNode } from "react";
import { type Metadata, type Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import Provider from "@/components/contexts";
import BrushDefs from "@/components/af/BrushDefs";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  variable: "--font-display",
  display: "swap",
});
const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Artfinity · Every wall is a shop", template: "%s · Artfinity" },
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
  openGraph: {
    siteName: "Artfinity",
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: "Artfinity. Every wall is a shop." }],
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
        <BrushDefs />
        <Provider>{children}</Provider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
};

export default RootLayout;
