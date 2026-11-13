import { CSSProperties } from "react";
import { BrushStroke } from "@/components/af/Brush";
import Stage from "./Stage";
import s from "./motion.module.css";
import { cn } from "@/lib/utils";

/**
 * A brush stroke that paints itself in, left to right, the first time it scrolls into view.
 * Strokes that load on screen are simply there (nothing blinks). Decorative.
 */
export default function BrushWipe({ className, color, delay = 0.15, style }: { className?: string; color?: string; delay?: number; style?: CSSProperties }) {
  return (
    <Stage as="span" once threshold={0.6} aria-hidden="true" className={cn(s.wipe, "block", className)} style={{ ["--wipe-delay" as string]: `${delay}s`, ...style }}>
      <BrushStroke className="h-full w-full" color={color} />
    </Stage>
  );
}
