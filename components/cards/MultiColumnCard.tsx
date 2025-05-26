import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const MultiColumnCard = ({
  img,
  title,
  subTitle,
  description,
  className,
}: {
  img: string;
  title: string;
  subTitle?: string;
  description?: string;
  className?: string;
}): ReactNode => {
  return (
    <div
      className={cn(
        "grid items-start justify-center gap-2 text-center",
        className,
      )}
    >
      <div className="area-media h-full w-full">
        <Image
          src={img}
          alt={title}
          className="area-image mx-auto h-20 rounded-sm object-contain md:h-28"
          width={250}
          height={250}
        />
      </div>
      <div className="area-content h-full w-full">
        {subTitle && (
          <h6 className="area-sub-title capitalize text-slate-800 opacity-75 dark:text-slate-200">
            {subTitle}
          </h6>
        )}
        <h4 className="area-title capitalize">{title}</h4>
        {description && (
          <p className="area-text max-w-screen-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default MultiColumnCard;
