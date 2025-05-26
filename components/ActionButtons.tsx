import { ArrowRight } from "lucide-react";
import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionButtonType } from "@/types";
import { cn } from "@/lib/utils";

const ActionButtons = ({
  btns,
  className,
}: {
  btns?: ActionButtonType[];
  className?: string;
}): ReactNode => {
  return btns && btns.length ? (
    <div
      className={cn(
        "action-btns flex items-center justify-center gap-2 md:gap-4",
        className,
      )}
    >
      {btns.map((btn, index) => (
        <Link
          key={index}
          href={btn?.href}
          target={btn.openInNewTab ? "_blank" : "_self"}
          className="btn-link"
        >
          <Button
            className={cn(
              "actio-btn btn flex items-center justify-center gap-1 rounded-none px-4 py-5 font-semibold capitalize",
              btn?.className,
            )}
            variant={btn?.variant}
          >
            {btn?.icon && btn?.iconPos === "start" && (
              <ArrowRight strokeWidth={1.25} width={15} />
            )}{" "}
            {btn?.title}{" "}
            {btn?.icon &&
              btn?.iconPos !== "end" &&
              btn?.icon === "arrowRight" && (
                <ArrowRight strokeWidth={1.25} width={15} />
              )}
          </Button>
        </Link>
      ))}
    </div>
  ) : (
    <></>
  );
};

export default ActionButtons;
