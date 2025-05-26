"use client";

import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import notFoundImage from "@/public/assets/images/svgs/error-pages/404-error.svg";

const notFoundPage = (): ReactNode => {
  return (
    <div
      className={cn(
        "grid min-h-screen items-center justify-center text-center",
        "min-h-[100svh]",
      )}
    >
      <Image
        src={notFoundImage}
        width={480}
        height={480}
        className="mb-5 aspect-square max-w-full fill-theme-primary object-contain px-8 md:px-3"
        loading="eager"
        alt="404 - Page not found"
      />
      <div className="text-lg md:text-2xl">
        <Link
          href="/"
          className="font-bold hover:underline focus-visible:underline"
        >
          <Button type="button" className="font-quaternary uppercase">
            <Home
              strokeWidth={2.25}
              width={15}
              height={15}
              className="!text-white"
            />
            &ensp;Go To Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default notFoundPage;
