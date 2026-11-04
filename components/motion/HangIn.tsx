import { ReactNode } from "react";
import s from "./motion.module.css";
import { cn } from "@/lib/utils";

/**
 * Optional entrance for the scan page artwork: the piece settles on its nail once on load.
 * Visible from the first frame (only rotation and a few pixels of drop), no JS,
 * skipped with reduced motion. Wrap the framed image: <HangIn><img …/></HangIn>.
 */
export default function HangIn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(s.hangIn, className)}>{children}</div>;
}
