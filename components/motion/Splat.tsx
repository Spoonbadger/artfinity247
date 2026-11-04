import { ReactNode } from "react";
import Stage from "./Stage";
import s from "./motion.module.css";
import { cn } from "@/lib/utils";

/** Paint dabs (.paint-dab) inside land with a squash the first time they scroll into view. */
export default function Splat({ children, className, as = "span" }: { children: ReactNode; className?: string; as?: "span" | "div" | "li" }) {
  return (
    <Stage as={as} once threshold={0.5} className={cn(s.splat, className)}>
      {children}
    </Stage>
  );
}
