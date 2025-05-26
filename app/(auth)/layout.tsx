"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLoadingStatus } from "@/components/contexts";
import PageLoading from "@/components/PageLoading";

const Layout = ({ children }: { children: ReactNode }) => {
  const { isLoading } = useLoadingStatus();

  return (
    <div
      className={cn(
        "app grid min-h-[100svh] grid-cols-1 items-center justify-center",
        isLoading && "fixed inset-0 -z-50 max-h-[100svh] overflow-hidden",
      )}
    >
      <main>{children}</main>
      {isLoading && <PageLoading />}
    </div>
  );
};

export default Layout;
