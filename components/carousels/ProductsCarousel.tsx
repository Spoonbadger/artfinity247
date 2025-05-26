"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import ActionButtons from "@/components/ActionButtons";
import { ProductCard } from "@/components/cards";
import { ProductType } from "@/types";

const ProductsCarousel = ({
  title,
  subTitle,
  description,
  products,
  baseUrl = "/products",
  showActionBtns = true,
  loop = false,
  notFoundMsg = "No Products Found",
  className,
}: {
  title: string;
  subTitle?: string;
  description?: string;
  products: ProductType[];
  baseUrl?: string;
  showActionBtns?: boolean;
  loop?: boolean;
  notFoundMsg?: string;
  className?: string;
}): ReactNode => {
  return (
    <div className={cn("grid gap-2", className)}>
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
      <div className="area-content flex items-center justify-center">
        {products.length > 0 ? (
          <Carousel
            className="grid max-w-full items-center justify-center"
            opts={{ loop }}
          >
            <CarouselContent className="carousel-slides px-6 py-4 md:px-0">
              {products.map((product, index) => (
                <CarouselItem
                  key={index}
                  className="basis-full sm:basis-1/2 lg:basis-1/4"
                >
                  <Link href={`${baseUrl}/${product.slug}`}>
                    <ProductCard
                      product={product}
                      showSeller={true}
                      className="h-full"
                    />
                  </Link>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div
              className={cn(
                "mx-auto flex w-full items-center justify-center gap-2",
                "[&>*]:static [&>*]:translate-y-0 [&>*]:border-none [&>*]:!bg-transparent [&>*]:!text-theme-primary [&>*]:opacity-70 [&>*]:shadow-none hover:[&>*]:opacity-100",
              )}
            >
              <CarouselPrevious />
              <CarouselNext />
            </div>
          </Carousel>
        ) : (
          <p className="mb-6 w-full py-6 text-center text-lg capitalize md:mb-8 md:py-12 md:text-xl">
            {notFoundMsg}
          </p>
        )}
      </div>
      {showActionBtns && (
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
      )}
    </div>
  );
};

export default ProductsCarousel;
