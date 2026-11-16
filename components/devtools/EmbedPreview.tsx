"use client";
// Renders a real embed on our own pages: loads /embed.js once, then asks it to (re)scan.
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ArtfinityGlobal = { scan: (root?: ParentNode) => void };

let loading: Promise<void> | null = null;
function loadScript() {
  const w = window as unknown as { Artfinity?: ArtfinityGlobal };
  if (w.Artfinity) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/embed.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error("embed.js failed to load")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export type EmbedAttrs = Record<`data-${string}`, string | number | undefined>;

type Frame = { src: string; height: number; width?: number };

export default function EmbedPreview({
  attrs, className, label = "your-site.com", bare = false, iframe, dark,
}: {
  attrs: EmbedAttrs;
  className?: string;
  label?: string;
  bare?: boolean;
  /** Show this plain iframe instead of the embed.js div (embed.js still resizes it, as it would on a real page). */
  iframe?: Frame;
  /** Dark backdrop, for dark-theme embeds. Defaults to data-theme="dark". */
  dark?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(attrs);
  useEffect(() => {
    let off = false;
    loadScript()
      .then(() => {
        if (off || !ref.current) return;
        (window as unknown as { Artfinity: ArtfinityGlobal }).Artfinity.scan(ref.current.parentNode || document);
      })
      .catch(() => {});
    return () => { off = true; };
  }, [key]);

  const embed = iframe ? (
    <iframe
      key={iframe.src}
      src={iframe.src}
      width={iframe.width ?? "100%"}
      height={iframe.height}
      className="mx-auto block max-w-full border-0"
      loading="lazy"
      title="Embed preview"
    />
  ) : (
    <div ref={ref} {...attrs} />
  );
  if (bare) return embed;
  return (
    <figure className={cn("min-w-0 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_2px_0_var(--af-line)]", className)}>
      <figcaption className="flex items-center gap-2 border-b border-line bg-wall px-3 py-2 text-[13px] text-ink-2">
        <span className="flex gap-1" aria-hidden="true">
          <i className="h-2.5 w-2.5 rounded-full bg-coral/70" />
          <i className="h-2.5 w-2.5 rounded-full bg-sticker" />
          <i className="h-2.5 w-2.5 rounded-full bg-earned/60" />
        </span>
        <span className="truncate rounded-full bg-white px-2.5 py-0.5">{label}</span>
        <span className="ml-auto">Live preview</span>
      </figcaption>
      <div className={cn("p-2.5 sm:p-5", (dark ?? attrs["data-theme"] === "dark") && "bg-[#26272e]")}>{embed}</div>
    </figure>
  );
}
