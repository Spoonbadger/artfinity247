import { ReactNode } from "react";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import CookieBanner from "@/components/CookieBanner";

// The header hides itself on artist storefront pages, which render their own (with the artist's name).
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CookieBanner />
    </div>
  );
}
