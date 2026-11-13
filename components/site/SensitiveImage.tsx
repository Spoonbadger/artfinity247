"use client";

import { ReactNode, useState } from "react";
import { useSensitivePref } from "@/components/site/useSensitivePref";

/** Wraps artwork media. If the piece has sensitive labels and the viewer hasn't opted in, it's blurred with a "Show" button. */
export default function SensitiveImage({ labels, children, light = false }: { labels?: string[] | null; children: ReactNode; light?: boolean }) {
  const [pref] = useSensitivePref();
  const [revealed, setRevealed] = useState(false);
  const hidden = !!labels?.length && !pref && !revealed;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className={hidden ? (light ? "h-full w-full blur-md" : "sensitive-blur h-full w-full") : "h-full w-full"}>{children}</div>
      {hidden && (
        <div className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-ink/25 p-3 text-center text-white">
          <span className="text-[13px] font-bold drop-shadow">{labels!.join(" · ")}</span>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setRevealed(true); }} className="min-h-[44px] rounded-full bg-white px-5 text-[14px] font-bold text-ink">Show</button>
        </div>
      )}
    </div>
  );
}
