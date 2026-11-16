"use client";

import { memo, useEffect, useState } from "react";
import type { RoomFrame, RoomSize } from "@/lib/rooms";
import { photoScenesOn, photoSrc, photoSrcSet, sceneLabel as labelFor } from "@/lib/scenes/client";
import { cn } from "@/lib/utils";

/** Natural width/height of an image, measured once in the browser. 0.8 (portrait) until known. */
export function useImageAspect(url: string, given?: number | null) {
  const [aspect, setAspect] = useState<number>(given || 0.8);
  useEffect(() => {
    if (given) return setAspect(given);
    if (!url) return;
    let live = true;
    const img = new Image();
    img.onload = () => live && img.naturalHeight && setAspect(img.naturalWidth / img.naturalHeight);
    img.src = url;
    return () => {
      live = false;
    };
  }, [url, given]);
  return aspect;
}

export type RoomSceneProps = {
  scene: number;
  imageUrl: string;
  /** Image width / height; measured from the image when omitted. */
  aspect?: number;
  size: RoomSize;
  frame?: RoomFrame | null;
  mat?: boolean;
  blur?: boolean;
  /** Accessible name; omit for decorative thumbnails. */
  title?: string;
  className?: string;
  /** Artwork slug: the room is a composited photo from /api/scenes/render. */
  slug?: string;
  /** `sizes` for the photo's srcset (default: full width up to 600px). */
  sizes?: string;
  /** Load the photo right away (the first carousel slide) instead of lazily. */
  eager?: boolean;
};

/** One room photo with the print on the wall at true size, composited by /api/scenes/render. No photo scenes or no slug: a plain wall. */
export const RoomScene = memo(function RoomScene({ scene, size, frame, mat = true, blur, title, className, slug, sizes, eager }: RoomSceneProps) {
  const box = cn("relative aspect-[5/4] w-full overflow-hidden bg-wall", className);
  if (!photoScenesOn || !slug) return <div className={box} data-scene={scene} />;
  return (
    <div className={box} data-scene={scene}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoSrc(scene, slug, size, frame, 800, { mat, blur })}
        srcSet={photoSrcSet(scene, slug, size, frame, { mat, blur })}
        sizes={sizes || "(min-width: 768px) 600px, 100vw"}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        alt={title || ""}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
});

export const sceneLabel = (n: number) => labelFor(n);
