"use client";

import { ReactNode } from "react"
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useLoadingStatus } from "@/components/contexts";
import { NavBar, Footer } from "@/components/layout";
import PageLoading from "@/components/PageLoading";
import { getAppPages } from "@/db/query";


const AppPages = getAppPages();

const Layout = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const { isLoading } = useLoadingStatus();

  const fixedNavPages: string[] = [
    "/",
    `/${AppPages.search.slug}`,
    `/${AppPages.contact.slug}`,
    `/${AppPages.about_us.slug}`,
    `/${AppPages.products.slug}`,
    `/${AppPages.sellers.slug}`,
  ];
  const fixedNavStartPaths: string[] = [`/${AppPages.scenes.slug}`];

  const fixedNavPage =
    fixedNavPages.includes(pathname) ||
    fixedNavStartPaths.some((startPath) => pathname?.startsWith(startPath));


  return (
    <div
      className={cn(
        "app",
        isLoading && "fixed inset-0 -z-50 max-h-[100svh] overflow-hidden",
      )}
    >
      <NavBar fixedNav={fixedNavPage} />
      <main>{children}</main>
      <Footer />
      {isLoading && <PageLoading />}
    </div>
  );
};

export default Layout;
