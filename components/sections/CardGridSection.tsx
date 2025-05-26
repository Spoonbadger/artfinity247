"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import ActionButtons from "@/components/ActionButtons";

const CardGridSection = ({
  title,
  subTitle,
  description,
  children,
  className,
  baseUrl = "/",
}: {
  title: string;
  subTitle?: string;
  description?: string;
  children: ReactNode;
  baseUrl?: string;
  className?: string;
}): ReactNode => {
  return (
    <div className={cn("space-y-2", className)}>
      {subTitle && (
        <h5 className="area-sub-title capitalize text-slate-800 opacity-75 dark:text-slate-200">
          {subTitle}
        </h5>
      )}
      <h2 className="area-title capitalize">{title}</h2>
      {description && (
        <p className="area-text max-w-screen-sm text-muted-foreground">
          {description}
        </p>
      )}
      <div className="area-content grid gap-2 py-2 md:grid-cols-3 md:gap-4">
        {children}
      </div>
      <div className="action-btns py-2">
        <ActionButtons
          btns={[
            {
              title: "view all",
              href: baseUrl,
            },
          ]}
        />
      </div>
    </div>
  );
};

export default CardGridSection;
