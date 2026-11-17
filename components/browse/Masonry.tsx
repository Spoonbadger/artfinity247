"use client";

import { Children, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Columns by width: 2 on phones, 3 from 768px, 4 from 1024px (the old grid's breakpoints). */
function colsNow() {
  if (window.matchMedia("(min-width: 1024px)").matches) return 4;
  if (window.matchMedia("(min-width: 768px)").matches) return 3;
  return 2;
}

/**
 * Masonry: equal-width columns, each piece at its own height. Items go round the columns in order (1 2 3 4 /
 * 5 6 7 8…), so a sorted list still reads left to right, and nothing moves while images load. The server's
 * guess (`initialCols`, from the device) is corrected before the first paint after hydration.
 */
export default function Masonry({ children, initialCols, className }: { children: ReactNode; initialCols: number; className?: string }) {
  const items = Children.toArray(children);
  const [cols, setCols] = useState(initialCols);
  useIso(() => {
    const update = () => setCols(colsNow());
    update();
    const queries = [window.matchMedia("(min-width: 1024px)"), window.matchMedia("(min-width: 768px)")];
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, []);
  const columns = Array.from({ length: cols }, (_, c) => items.filter((_, i) => i % cols === c));
  return (
    <div className={cn("art-grid art-masonry flex items-start gap-x-3 sm:gap-x-5 lg:gap-x-7", className)}>
      {columns.map((col, c) => (
        <div key={c} className="flex min-w-0 flex-1 flex-col gap-y-7 lg:gap-y-10">
          {col}
        </div>
      ))}
    </div>
  );
}
