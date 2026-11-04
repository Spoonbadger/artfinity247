"use client";

import { FRAME_COLORS, FrameColor, PrintSize, SIZE_IN } from "@/components/art/pricing";
import { cn } from "@/lib/utils";

// The room is drawn in inches so the print is always to scale.
const ROOM_W = 120;
const ROOM_H = 72;
const SOFA_W = 84;
const SOFA_H = 33;
const GAP = 9; // print hangs this far above the sofa back

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export default function WallPreview({
  imageUrl,
  alt,
  size,
  framed,
  frameColor,
  landscape,
  blur,
  className,
}: {
  imageUrl: string;
  alt: string;
  size: PrintSize;
  framed: boolean;
  frameColor: FrameColor;
  landscape: boolean;
  blur?: boolean;
  className?: string;
}) {
  const [a, b] = SIZE_IN[size];
  const frame = framed ? 1.25 : 0;
  const w = (landscape ? b : a) + frame * 2;
  const h = (landscape ? a : b) + frame * 2;
  const frameHex = FRAME_COLORS.find((f) => f.key === frameColor)?.hex ?? "#15161b";
  const label = `${landscape ? `${b} × ${a}` : `${a} × ${b}`} in${framed ? ", framed" : ""}`;

  return (
    <figure className={cn("relative overflow-hidden rounded-2xl bg-gallery", className)} style={{ aspectRatio: `${ROOM_W} / ${ROOM_H}` }}>
      <figcaption className="absolute left-3 top-2.5 z-10 text-[13px] font-semibold text-ink">
        {label} <span className="font-normal text-ink-2">above an {SOFA_W} in sofa</span>
      </figcaption>
      {/* soft wall light */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,255,255,.7),transparent_65%)]" />
      {/* the print */}
      <div
        className="absolute shadow-[0_3px_8px_rgba(21,22,27,.28)] transition-all duration-300 ease-out"
        style={{
          left: pct((ROOM_W - w) / 2, ROOM_W),
          bottom: pct(SOFA_H + GAP, ROOM_H),
          width: pct(w, ROOM_W),
          height: pct(h, ROOM_H),
          background: framed ? frameHex : "#fff",
          // % padding resolves against the room's width, which is what we want (inches → %)
          padding: framed ? pct(frame, ROOM_W) : "1px",
          outline: framed && frameColor === "white" ? "1px solid rgba(21,22,27,.15)" : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className={cn("block h-full w-full object-cover", blur && "blur-[3px]")} />
      </div>
      {/* sofa */}
      <svg
        aria-hidden
        viewBox="0 0 84 33"
        preserveAspectRatio="none"
        className="absolute bottom-0"
        style={{ left: pct((ROOM_W - SOFA_W) / 2, ROOM_W), width: pct(SOFA_W, ROOM_W), height: pct(SOFA_H, ROOM_H) }}
      >
        <rect x="4" y="0" width="76" height="20" rx="4" fill="#8f8b83" />
        <rect x="0" y="12" width="9" height="19" rx="3.5" fill="#7d7972" />
        <rect x="75" y="12" width="9" height="19" rx="3.5" fill="#7d7972" />
        <rect x="8" y="17" width="68" height="12" rx="2.5" fill="#9b978e" />
        <rect x="10" y="29" width="3" height="4" fill="#5c5952" />
        <rect x="71" y="29" width="3" height="4" fill="#5c5952" />
      </svg>
      {/* floor lamp */}
      <svg aria-hidden viewBox="0 0 14 62" className="absolute bottom-0" style={{ right: pct(5, ROOM_W), width: pct(14, ROOM_W), height: pct(62, ROOM_H) }}>
        <path d="M2 0 H12 L14 11 H0 Z" fill="#dccfb4" />
        <rect x="6.4" y="11" width="1.2" height="49" fill="#6f6c66" />
        <rect x="3" y="60" width="8" height="2" rx="1" fill="#6f6c66" />
      </svg>
      {/* plant */}
      <svg aria-hidden viewBox="0 0 16 30" className="absolute bottom-0" style={{ left: pct(4, ROOM_W), width: pct(16, ROOM_W), height: pct(30, ROOM_H) }}>
        <path d="M8 20 C 2 14, 1 6, 3 1 C 6 6, 8 12, 8 20 Z" fill="#6f8a6a" />
        <path d="M8 20 C 13 13, 15 7, 13 2 C 10 7, 8 13, 8 20 Z" fill="#5d7a5a" />
        <path d="M8 21 C 4 18, 0 16, 0 11 C 4 13, 7 16, 8 21 Z" fill="#7f9a78" />
        <path d="M4 20 H12 L11 30 H5 Z" fill="#b9805a" />
      </svg>
      <span className="sr-only">{alt}, shown at {label} above an {SOFA_W} inch sofa</span>
    </figure>
  );
}
