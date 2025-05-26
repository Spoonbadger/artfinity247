import { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const Loader = ({ className }: { className?: string }): ReactNode => {
  return (
    <div
      className={cn(
        "min-h-8 min-w-8 animate-spin rounded-full border-t-4 border-slate-100",
        className,
      )}
    ></div>
  );
};

export default Loader;
