import { ReactNode } from "react";
import Image from "next/image";
import { cn, shuffleArray } from "@/lib/utils";
import { ActionButtonType } from "@/types";
import ActionButtons from "@/components/ActionButtons";

export const getArrInGrops = (
  arr: any[],
  index: number,
  groupOf: number = 5,
) => {
  return arr.slice(
    Math.floor(arr.length / groupOf) * index,
    Math.floor(arr.length / groupOf) * (index + 1),
  );
};

const ImageGallery = ({
  title,
  subTitle,
  content,
  imgs,
  columns = 4,
  className,
  shuffleImgs = false,
  animate = false,
  asBackground = false,
  actionBtns = [],
}: {
  title?: string;
  subTitle?: string;
  content?: string;
  imgs: string[];
  columns?: number;
  className?: string;
  shuffleImgs?: boolean;
  animate?: boolean;
  asBackground?: boolean;
  actionBtns?: ActionButtonType[];
}): ReactNode => {
  imgs = !shuffleImgs ? imgs : shuffleArray(imgs);

  return (
    <div
      className={cn(
        "grid items-center justify-center gap-2 text-center md:gap-4",
        className,
      )}
    >
      <h5 className="area-sub-title font-tertiary text-muted">{subTitle}</h5>
      <h2 className="area-title font-extrabold uppercase">{title}</h2>
      <p className="area-text text-muted">{content}</p>
      <ActionButtons btns={actionBtns} />

      <div
        className={cn(
          "img-galley pointer-events-none grid h-full w-full select-none grid-cols-2 gap-2 overflow-hidden md:grid-cols-4 md:gap-4",
          asBackground && "absolute inset-0 -z-50",
          animate &&
            "max-h-screen overflow-y-hidden  [&>:nth-child(even)]:animate-infinite-y-scroll [&>:nth-child(odd)]:-animate-infinite-y-scroll",
        )}
      >
        {Array(columns)
          .fill(0)
          .map((_, index) => (
            <div
              key={index}
              className={cn(
                "space-y-2 md:space-y-4",
                index >= 2 && "hidden md:block",
              )}
            >
              {Array(animate ? 2 : 1)
                .fill(0)
                .map((_, key) => (
                  <ul
                    key={key}
                    className="grid grid-cols-1 items-center justify-center gap-2 md:justify-start md:gap-4"
                  >
                    {getArrInGrops(imgs, index, columns).map((img, index) => (
                      <li key={index}>
                        <Image
                          src={img}
                          width={250}
                          height={250}
                          className="w-full object-contain"
                          alt="Scroll Area Image"
                        />
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          ))}
      </div>
    </div>
  );
};

export default ImageGallery;
