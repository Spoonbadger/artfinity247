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
  onEditPhoto,
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
  onEditPhoto?: () => void;
}): ReactNode => {
  return (
  <div
    className={cn(
      "container relative isolate mx-auto flex w-full flex-col items-center gap-4 md:flex-row md:gap-6",
      imgAlign === "right" && "md:flex-row-reverse",
      className
    )}
  >
    {/* ---------- IMAGE SIDE ---------- */}
    <div className="area-media w-full md:w-1/2 flex flex-col items-center">
  <div className="relative inline-block rounded-lg overflow-hidden">
    <div className="group relative inline-block">
      <Image
        src={img}
        alt={title || ""}
        className="area-image rounded-lg object-cover drop-shadow-lg max-h-[50vh] md:max-h-[75vh]"
        width={400}
        height={400}
        loading={imgLoading}
      />
      {typeof onEditPhoto === "function" && (
        <button
          onClick={onEditPhoto}
          className="absolute inset-0 bg-black/60 text-white text-sm opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
        >
          Upload New Profile Picture
        </button>
      )}
    </div>
  </div>
    </div>

    {/* ---------- TEXT SIDE ---------- */}
    <div
      className={cn(
        "area-content grid w-full grid-cols-1 px-4 text-center md:w-1/2",
        txtAlign === "right"
          ? "md:justify-end md:text-right"
          : txtAlign === "center"
          ? "md:justify-center md:text-center"
          : "md:justify-start md:text-left"
      )}
    >
      <div className="space-y-2 rounded-lg px-2.5 py-4 md:px-6">
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
                : "md:justify-start"
            )}
          />
        </div>
      </div>
    </div>
  </div>
);
}

export default ImageWithText;
