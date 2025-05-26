import { ReactNode } from "react";
import { type Metadata } from "next";
import { Crimson_Text, Karla, Roboto, Roboto_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { getAppConfigs } from "@/db/query";
import Provider from "@/components/contexts";
import "./globals.css";

const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-primary",
});
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-secondary",
});
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-tertiary",
});
const karla = Karla({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-quaternary",
});

const AppConfigs = getAppConfigs();

export const metadata: Metadata = {
  title: {
    absolute: "",
    default: `${AppConfigs.app_name || "Demo App"}`,
    template: `%s: ${AppConfigs.app_name || "Demo App"}`,
  },
  description: `${AppConfigs.app_description || "This is a demo app."}`,
};

const RootLayout = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  return (
    <html lang="en">
      <body
        className={cn(
          "font-primary",
          crimsonText.variable,
          roboto.variable,
          robotoMono.variable,
          karla.variable,
        )}
      >
        <Provider>{children}</Provider>
        <Toaster />
      </body>
    </html>
  );
};

export default RootLayout;
