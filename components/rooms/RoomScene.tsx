"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";
import { renderScene, sceneInfo, type RoomFrame, type RoomSize } from "@/lib/rooms";
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
};

/** One room with the print on the wall, drawn as inline SVG at true size. */
export const RoomScene = memo(function RoomScene({ scene, imageUrl, aspect, size, frame, mat = true, blur, title, className }: RoomSceneProps) {
  // a stable, page-unique prefix for this instance's SVG ids
  const idp = "rs" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const measured = useImageAspect(imageUrl, aspect);
  const html = useMemo(
    () => renderScene(scene, { href: imageUrl, aspect: measured, size, frame: frame ?? null, mat, blur }, { idp: `${idp}s${scene}`, title }),
    [scene, imageUrl, measured, size, frame, mat, blur, idp, title],
  );
  return (
    <div
      className={cn("relative aspect-[5/4] w-full overflow-hidden bg-wall [&>svg]:block [&>svg]:h-full [&>svg]:w-full", className)}
      data-scene={scene}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export const sceneLabel = (n: number) => sceneInfo(n).label;
