"use client";

import { ReactNode, Fragment } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Slash } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const PageBreadcrumb = ({
  type = "normal",
  className,
}: {
  type?: "normal" | "page-banner";
  className?: string;
}): ReactNode => {
  const pathname = usePathname();

  const breadcrumbItems = pathname.split("/").filter((item) => item);
  return (
    <Breadcrumb
      className={cn(
        type === "page-banner" &&
          "[&_.lucide]:text-gray-300 [&_ol_li]:uppercase",
        className,
      )}
    >
      <BreadcrumbList className="!gap-1 drop-shadow-md">
        <BreadcrumbItem>
          <BreadcrumbPage
            className={cn(type === "page-banner" && "!text-background/95")}
          >
            Home
          </BreadcrumbPage>
        </BreadcrumbItem>
        {breadcrumbItems.map((item, index) => (
          <Fragment key={index}>
            {type === "page-banner" ? (
              <BreadcrumbSeparator>
                <Slash />
              </BreadcrumbSeparator>
            ) : (
              <BreadcrumbSeparator />
            )}
            <BreadcrumbItem>
              {index !== breadcrumbItems.length - 1 ? (
                <BreadcrumbLink
                  href={`/${breadcrumbItems.slice(0, index + 1).join("/")}`}
                  className={cn(
                    type === "page-banner" && "!text-background/95",
                  )}
                >
                  {item}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage
                  className={cn(
                    type === "page-banner" && "!text-background/95",
                  )}
                >
                  {item}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default PageBreadcrumb;
