"use client";

import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import internalServerError from "@/public/assets/images/svgs/error-pages/500-error.svg";

const ErrorBoundary = ({ error }: { error: Error }): ReactNode => {
  console.log("Error: >> ", error.message);

  return (
    <div
      className={cn(
        "grid min-h-screen items-center justify-center text-center",
        "min-h-[100svh]",
      )}
    >
      <Image
        src={internalServerError}
        width={480}
        height={480}
        className="mb-5 aspect-square max-w-full object-contain px-8 md:px-3"
        loading="eager"
        alt="Some Error Occured"
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

export default ErrorBoundary;
