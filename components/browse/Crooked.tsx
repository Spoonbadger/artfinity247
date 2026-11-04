import { ReactNode } from "react";
import { BrushStroke } from "@/components/af/Brush";

/** A crooked, empty frame on a gallery wall, with something painted inside. Used by 404 and error pages. */
export default function CrookedFrame({ children, stroke = "var(--af-sticker)" }: { children: ReactNode; stroke?: string }) {
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-[420px] overflow-hidden rounded-[20px] bg-gallery" aria-hidden="true">
      <BrushStroke className="absolute -left-8 top-[18%] h-[14%] w-[80%] -rotate-6 opacity-50" color={stroke} />
      <span className="absolute left-1/2 top-[9%] h-2 w-2 -translate-x-1/2 rounded-full bg-ink/60" />
      <div className="absolute left-1/2 top-[13%] w-[52%] -translate-x-1/2 rotate-[7deg] origin-top">
        <div className="grid aspect-[4/5] place-items-center bg-[#fbfaf6] shadow-[0_18px_30px_-10px_rgba(21,22,27,.45)] ring-[6px] ring-ink">
          {children}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[12%] bg-[#d7d1c4]" />
    </div>
  );
}
