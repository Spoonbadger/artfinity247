"use client";

// The page behind a collection's hang: the gallery wall, a palette color, or one of its paintings, blurred and tinted.
// Used on the public page and as the live preview in Studio.
import type { CSSProperties, ReactNode } from "react";
import { useSensitivePref } from "@/components/site/useSensitivePref";
import { colorById, SENSITIVE_BLUR, WALL_GRADIENT, type CollectionBackground } from "@/lib/collectionBackground";
import { cn } from "@/lib/utils";

export type BackdropImage = { url: string; sensitive: string[] } | null;

/** Base fill for a background: what shows before (or instead of) a painting. */
export function backdropFill(bg: CollectionBackground): CSSProperties {
  if (bg.kind === "color") return { backgroundColor: colorById(bg.color)?.hex };
  if (bg.kind === "painting") return { backgroundColor: colorById(bg.tint)?.hex };
  return { backgroundColor: "#efece5", backgroundImage: WALL_GRADIENT };
}

/** The blurred, tinted painting layer. `fixed` keeps it still behind a long page (the parent clips it). */
export function PaintingLayer({ bg, image, fixed = false, scale = 1 }: { bg: CollectionBackground; image: BackdropImage; fixed?: boolean; scale?: number }) {
  const [showSensitive] = useSensitivePref();
  if (bg.kind !== "painting" || !image) return null;
  // Sensitive art stays well blurred for anyone who hasn't chosen to see it, whatever the artist set.
  const hide = image.sensitive.length > 0 && !showSensitive;
  const blur = Math.round((hide ? Math.max(bg.blur, SENSITIVE_BLUR) : bg.blur) * scale);
  return (
    <div aria-hidden className={cn("pointer-events-none inset-0 -z-10 overflow-hidden", fixed ? "fixed" : "absolute")}>
      <div
        className="absolute inset-[-8%] bg-cover bg-center"
        style={{ backgroundImage: `url(${JSON.stringify(image.url)})`, filter: blur ? `blur(${blur}px)${hide ? " saturate(0.8)" : ""}` : undefined }}
      />
      <div className="absolute inset-0" style={{ backgroundColor: colorById(bg.tint)?.hex, opacity: bg.tintOpacity / 100 }} />
    </div>
  );
}

/** Wraps page content in its background. */
export default function CollectionBackdrop({ bg, image, className, children }: { bg: CollectionBackground; image: BackdropImage; className?: string; children: ReactNode }) {
  return (
    // isolate + clip-path: the fixed painting layer sits behind this content and never spills past it
    <div className={cn("relative isolate [clip-path:inset(0)]", className)} style={backdropFill(bg)}>
      <PaintingLayer bg={bg} image={image} fixed />
      {children}
    </div>
  );
}
