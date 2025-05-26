import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const BackgroundShadow = ({
  opacity,
  className,
}: {
  opacity?: "lightest" | "light" | "normal" | "dark" | "darkest" | "none";
  className?: string;
}): ReactNode => {
  let shadowOpacityClass = "bg-opacity-45";

  switch (opacity) {
    case "lightest":
      shadowOpacityClass = "bg-opacity-15";
      break;
    case "light":
      shadowOpacityClass = "bg-opacity-25";
      break;
    case "normal":
      shadowOpacityClass = "bg-opacity-35";
      break;
    case "dark":
      shadowOpacityClass = "bg-opacity-65";
      break;
    case "darkest":
      shadowOpacityClass = "bg-opacity-75";
      break;
    case "none":
      shadowOpacityClass = "bg-opacity-0";
      break;
    default:
      shadowOpacityClass = "bg-opacity-45";
      break;
  }

  return (
    <div
      className={cn(
        "bg-shadow absolute inset-0 -z-40 h-full w-full bg-black",
        shadowOpacityClass,
        className,
      )}
    ></div>
  );
};

export default BackgroundShadow;
