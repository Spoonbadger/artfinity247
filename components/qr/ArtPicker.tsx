"use client";

import type { ArtInfo } from "./card";
import s from "./qr-studio.module.css";

/** Thumbnail row: which artwork the code sells. */
export default function ArtPicker({ arts, slug, onPick }: { arts: ArtInfo[]; slug: string; onPick: (a: ArtInfo) => void }) {
  return (
    <div className={s.picker}>
      <h2 className={s.pickerH}>Which piece?</h2>
      <div className={s.thumbs} role="group" aria-label="Artwork">
        {arts.map((a) => (
          <button key={a.slug} type="button" aria-pressed={a.slug === slug} onClick={() => onPick(a)} className={s.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.imageUrl} alt="" loading="lazy" />
            <span>{a.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
