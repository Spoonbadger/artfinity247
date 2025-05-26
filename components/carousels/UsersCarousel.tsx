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
import { UserCard } from "@/components/cards";
import { UserType } from "@/types";

const UsersCarousel = ({
  title,
  subTitle,
  description,
  users,
  baseUrl = "/users",
  loop = false,
  notFoundMsg = "No Users Found",
  className,
}: {
  title: string;
  subTitle?: string;
  description?: string;
  users: UserType[];
  baseUrl?: string;
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
        {users.length > 0 ? (
          <Carousel
            className="grid max-w-full items-center justify-center"
            opts={{ loop }}
          >
            <CarouselContent className="carousel-slides px-6 py-4 md:px-0">
              {users.map((user, index) => (
                <CarouselItem
                  key={index}
                  className="basis-full sm:basis-1/2 lg:basis-1/4"
                >
                  <Link href={`${baseUrl}/${user.slug}`}>
                    <UserCard user={user} className="h-full" />
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

export default UsersCarousel;
