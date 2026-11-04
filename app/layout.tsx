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
