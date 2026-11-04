import { ReactNode } from "react";
import Stage from "./Stage";
import s from "./motion.module.css";
import { cn } from "@/lib/utils";

/**
 * A row that drifts sideways forever and pauses on hover or focus. The content is
 * rendered twice; the copy is hidden from assistive tech and keyboard.
 * At rest (and with reduced motion) it is a plain, full row.
 */
export default function Marquee({ children, seconds = 60, reverse = false, className, label }: { children: ReactNode; seconds?: number; reverse?: boolean; className?: string; label?: string }) {
  return (
    <Stage className={cn(s.marquee, className)} style={{ ["--dur" as string]: `${seconds}s` }} aria-label={label} role={label ? "region" : undefined}>
      <div className={cn(s.track, reverse && s.reverse)}>
        <div className={s.set}>{children}</div>
        <div className={s.set} aria-hidden="true" {...({ inert: "" } as Record<string, string>)}>{children}</div>
      </div>
    </Stage>
  );
}
