"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import EmblaAutoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselOptions,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { SliderType } from "@/types";
import ActionButtons from "@/components/ActionButtons";
import BackgroundShadow from "@/components/BackgroundShadow";
import { AppSliders } from "@/db";

export const homeHeroSlider = AppSliders[0] as SliderType;

const HeroSlider = ({
  slider = homeHeroSlider,
  options,
  shadowClassName,
  shadowOpacity = "none",
  className,
}: {
  slider?: SliderType | null;
  options?: CarouselOptions;
  shadowClassName?: string;
  shadowOpacity?: "lightest" | "light" | "normal" | "dark" | "darkest" | "none";
  className?: string;
}): ReactNode => {
  const pathname = usePathname();

  return (
    <Carousel
      opts={{ watchDrag: true, loop: true, ...options }}
      className={cn("hero-carousel select-none", className)}
      plugins={[EmblaAutoplay({ delay: 10000 })]}
    >
      <CarouselContent
        className={cn(
          "h-[45vh] md:h-[95vh]",
          pathname !== "/" && "md:h-screen-with-header",
        )}
      >
        {slider &&
          slider.slides.map((slide, index) => (
            <CarouselItem key={index} className="pl-0">
              <div
                style={{
                  backgroundImage: `url('${slide.bg}')`,
                }}
                className={cn(
                  "relative isolate grid aspect-video h-full w-full place-content-center gap-5 bg-cover bg-center bg-no-repeat p-14 text-center text-4xl sm:px-20 sm:py-header-scrolled md:h-screen md:gap-8 md:px-24 md:py-header lg:gap-10",
                  slide?.className,
                )}
              >
                <BackgroundShadow
                  className={shadowClassName}
                  opacity={shadowOpacity}
                />
                <p className="area-sub-title text-muted md:text-lg lg:text-xl">
                  {slide.subTitle}
                </p>
                <h1 className="area-title shadow-white xl:text-7xl">
                  {slide.title}
                </h1>
                <ActionButtons
                  btns={slide.actionBtns}
                  className="[&_.btn]:w-fit [&_.btn]:min-w-fit [&_.btn]:rounded-none [&_.btn]:font-quaternary [&_.btn]:font-semibold [&_.btn]:uppercase"
                />
              </div>
            </CarouselItem>
          ))}
      </CarouselContent>
      <CarouselPrevious className="left-0 translate-x-1/2 border-0 !bg-transparent opacity-55 focus-within:opacity-100 hover:opacity-100" />
      <CarouselNext className="right-0 -translate-x-1/2 border-0 !bg-transparent opacity-55 focus-within:opacity-100 hover:opacity-100" />
    </Carousel>
  );
};

export default HeroSlider;
