"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Loader from "@/components/Loader";

const PageLoading = (): ReactNode => {
  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex h-full min-h-screen w-full items-center justify-center bg-theme-primary",
        "min-h-[100svh]",
      )}
    >
      <Loader className="aspect-square size-24" />
    </div>
  );
};

export default PageLoading;
