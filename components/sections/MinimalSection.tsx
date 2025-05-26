import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ActionButtonType } from "@/types";
import ActionButtons from "@/components/ActionButtons";
import BackgroundShadow from "@/components/BackgroundShadow";

const MinimalSection = ({
  title,
  subTitle,
  content,
  actionBtns = [],
  bg,
  children,
  shadowClassName,
  shadowOpacity = "none",
  className,
}: {
  title?: string;
  subTitle?: string;
  content?: string;
  actionBtns?: ActionButtonType[];
  bg?: string;
  children?: ReactNode;
  shadowClassName?: string;
  shadowOpacity?: "lightest" | "light" | "normal" | "dark" | "darkest" | "none";
  className?: string;
}): ReactNode => {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 text-center md:text-center",
        bg && "relative isolate",
        className,
      )}
      style={{ background: bg ? `center / cover no-repeat url(${bg})` : "" }}
    >
      {subTitle && (
        <h5 className="area-sub-title text-slate-800 opacity-75 dark:text-slate-200">
          {subTitle}
        </h5>
      )}
      {title && <h2 className="area-title capitalize">{title}</h2>}
      {content && <p className="area-text">{content}</p>}
      <ActionButtons btns={actionBtns} />
      {bg && (
        <BackgroundShadow opacity={shadowOpacity} className={shadowClassName} />
      )}
      {children}
    </div>
  );
};

export default MinimalSection;
