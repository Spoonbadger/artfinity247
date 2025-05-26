import { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ActionButtonType } from "@/types";
import ActionButtons from "@/components/ActionButtons";

const ImageWithText = ({
  img,
  title,
  subTitle,
  description,
  actionBtns,
  imgAlign = "left",
  imgLoading = "lazy",
  txtAlign = "left",
  textAsPopup = false,
  children,
  className,
}: {
  img: string;
  title?: string;
  subTitle?: string;
  description?: string;
  actionBtns?: ActionButtonType[];
  imgAlign?: "left" | "right";
  imgLoading?: "eager" | "lazy";
  txtAlign?: "left" | "center" | "right";
  textAsPopup?: boolean;
  children?: ReactNode;
  className?: string;
}): ReactNode => {
  return (
    <div
      className={cn(
        "container relative isolate mx-auto flex w-full flex-col items-center gap-4 md:flex-row md:gap-6",
        imgAlign === "right" && "md:flex-row-reverse",
        className,
      )}
    >
      <div className="area-media w-full md:w-1/2">
        <Image
          src={img}
          alt={title || ""}
          className="area-image mx-auto max-h-[50vh] rounded-lg object-cover drop-shadow-lg md:max-h-[75vh]"
          width={400}
          height={400}
          loading={imgLoading}
        />
      </div>
      <div
        className={cn(
          "area-content grid w-full grid-cols-1 px-4 text-center md:w-1/2",
          txtAlign === "right"
            ? "md:justify-end md:text-right"
            : txtAlign === "center"
              ? "md:justify-center md:text-center"
              : "md:justify-start md:text-left",
        )}
      >
        <div
          className={cn(
            "space-y-2 rounded-lg px-2.5 py-4 md:translate-y-0 md:px-6",
            textAsPopup &&
              "-translate-y-1/3 bg-background py-8 shadow-md md:absolute md:top-1/2 md:z-40 md:w-[60%] md:-translate-y-1/2",
            textAsPopup &&
              (imgAlign === "right" ? "md:right-[40%]" : "md:left-[40%]"),
          )}
        >
          {title && <h2 className="area-title capitalize">{title}</h2>}
          {subTitle && (
            <h5 className="area-sub-title capitalize text-slate-800 opacity-75 dark:text-slate-200">
              {subTitle}
            </h5>
          )}
          {description && (
            <p className="area-text line-clamp-3 max-w-screen-sm text-muted-foreground">
              {description}
            </p>
          )}
          {children && <div>{children}</div>}
          <div className="action-btns py-2">
            <ActionButtons
              btns={actionBtns}
              className={cn(
                txtAlign === "right"
                  ? "md:justify-end"
                  : txtAlign === "center"
                    ? "md:justify-center"
                    : "md:justify-start",
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageWithText;
