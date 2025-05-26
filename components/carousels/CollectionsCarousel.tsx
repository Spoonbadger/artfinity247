import { ReactNode } from "react";
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
import { CollectionCard } from "@/components/cards";
import { CollectionType } from "@/types";

const CollectionsCarousel = ({
  title,
  subTitle,
  description,
  collections,
  baseUrl = "/collections",
  loop = false,
  notFoundMsg = "No Collections Found",
  className,
}: {
  title: string;
  subTitle?: string;
  description?: string;
  collections: CollectionType[];
  baseUrl?: string;
  loop?: boolean;
  notFoundMsg?: string;
  className?: string;
}): ReactNode => {
  return (
    <div className={cn("", className)}>
      {subTitle && (
        <h5 className="area-sub-title mb-2 capitalize text-slate-800 opacity-75 dark:text-slate-200">
          {subTitle}
        </h5>
      )}
      <h2 className="area-title mb-2 capitalize">{title}</h2>
      {description && (
        <p className="area-text mb-2 max-w-screen-sm text-muted-foreground">
          {description}
        </p>
      )}
      <div className="area-content flex items-center justify-center">
        {collections.length > 0 ? (
          <Carousel
            className="grid max-w-full items-center justify-center"
            opts={{ loop }}
          >
            <CarouselContent className="carousel-slides px-6 py-4 md:px-0">
              {collections.map((collection, index) => (
                <CarouselItem
                  key={index}
                  className="basis-full sm:basis-1/2 lg:basis-1/4"
                >
                  <Link href={`${baseUrl}/${collection.slug}`}>
                    <CollectionCard
                      collection={collection}
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

export default CollectionsCarousel;
