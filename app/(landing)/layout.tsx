import { ReactNode } from "react";
import SiteFooter from "@/components/site/SiteFooter";
import CookieBanner from "@/components/CookieBanner";

// `header` is the @header slot: the site header, or the artist's storefront header on /@handle pages.
export default function Layout({ children, header }: { children: ReactNode; header: ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col">
      {header}
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CookieBanner />
    </div>
  );
}
