import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { ReviewType } from "@/types";
import { ReviewCard } from "@/components/cards";

const ReviewCarousel = ({
  title,
  subTitle,
  description,
  reviews,
  showLink = true,
  loop = false,
  notFoundMsg = "No Reviews Found",
  className,
}: {
  title: string;
  subTitle?: string;
  description?: string;
  reviews: ReviewType[];
  showLink?: boolean;
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
        <Carousel
          className="grid max-w-full items-center justify-center"
          opts={{ loop }}
        >
          {reviews.length > 0 ? (
            <CarouselContent className="carousel-slides px-6 py-6 md:px-0">
              {reviews.map((review, index) => (
                <CarouselItem
                  key={index}
                  className="basis-full select-none sm:basis-1/2 lg:basis-1/3"
                >
                  <ReviewCard
                    review={review}
                    className="h-full"
                    txtAlign="left"
                    showLink={showLink}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          ) : (
            <p className="mb-6 w-full py-6 text-center text-lg capitalize md:mb-8 md:py-12 md:text-xl">
              {notFoundMsg}
            </p>
          )}
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
      </div>
    </div>
  );
};

export default ReviewCarousel;
