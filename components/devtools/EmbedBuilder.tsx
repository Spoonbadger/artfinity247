"use client";
// Pick an embed, tweak it, copy the snippet, see it live. Used on /developers and /studio/developers.
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import Code from "./Code";
import EmbedPreview, { type EmbedAttrs } from "./EmbedPreview";
import { buySnippet, cardSnippet, gallerySnippet, iframeSnippet, linksSnippet, type Layout, type Theme } from "./snippets";

export type Kind = "gallery" | "card" | "buy" | "links" | "iframe";
export type PickArt = { slug: string; title: string; imageUrl: string; sensitive: string[] };

export const KIND_LABEL: Record<Kind, string> = { gallery: "Gallery", card: "One piece", buy: "Buy button", links: "Link in bio", iframe: "Iframe" };

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-[12px] font-semibold text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "rounded-full border-[1.5px] px-3 py-1 text-[13px] font-semibold transition",
              value === v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function EmbedBuilder({
  handle, artworks, kinds = ["gallery", "card", "buy", "links", "iframe"], initialKind, initialSlug, initialLayout = "grid", stacked = false, footer,
}: {
  handle: string;
  artworks: PickArt[];
  kinds?: Kind[];
  initialKind?: Kind;
  initialSlug?: string;
  initialLayout?: Layout;
  /** Code above preview, even on wide screens. */
  stacked?: boolean;
  /** Shown under the code block. */
  footer?: ReactNode;
}) {
  const [kind, setKind] = useState<Kind>(initialKind || kinds[0]);
  const [layout, setLayout] = useState<Layout>(initialLayout);
  const [limit, setLimit] = useState(6);
  const [theme, setTheme] = useState<Theme>("light");
  const [slug, setSlug] = useState(initialSlug || artworks[0]?.slug || "");
  const art = artworks.find((a) => a.slug === slug);

  let code = "";
  let attrs: EmbedAttrs = {};
  const t = theme === "dark" ? "dark" : undefined;
  if (kind === "gallery") {
    code = gallerySnippet(handle, { layout, limit, theme });
    attrs = { "data-artfinity-artist": handle, "data-layout": layout, "data-limit": layout === "single" ? undefined : limit, "data-theme": t };
  } else if (kind === "card") {
    code = cardSnippet(slug, theme);
    attrs = { "data-artfinity-art": slug, "data-theme": t };
  } else if (kind === "buy") {
    code = buySnippet(slug);
    attrs = { "data-artfinity-buy": slug };
  } else if (kind === "iframe") {
    code = iframeSnippet(slug, art ? art.title : "Artwork");
  } else {
    code = linksSnippet(handle, theme);
    attrs = { "data-artfinity-links": handle, "data-theme": t };
  }
  const needsArt = kind === "card" || kind === "buy" || kind === "iframe";

  return (
    <div className={cn("grid min-w-0 gap-5", !stacked && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start")}>
      <div className="grid min-w-0 gap-4">
        {kinds.length > 1 && <Seg label="Embed" value={kind} onChange={setKind} options={kinds.map((k) => [k, KIND_LABEL[k]])} />}
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {kind === "gallery" && (
            <>
              <Seg label="Layout" value={layout} onChange={setLayout} options={[["grid", "Grid"], ["carousel", "Carousel"], ["single", "Single"]]} />
              {layout !== "single" && (
                <Seg label="Pieces" value={String(limit)} onChange={(v) => setLimit(Number(v))} options={[["3", "3"], ["6", "6"], ["9", "9"], ["12", "12"]]} />
              )}
            </>
          )}
          {kind !== "buy" && kind !== "iframe" && <Seg label="Theme" value={theme} onChange={setTheme} options={[["light", "Light"], ["dark", "Dark"]]} />}
        </div>
        {needsArt && artworks.length > 1 && (
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-semibold text-ink-2">Piece</legend>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {artworks.map((a) => (
                <button
                  key={a.slug}
                  type="button"
                  onClick={() => setSlug(a.slug)}
                  aria-pressed={a.slug === slug}
                  title={a.title}
                  className={cn("relative h-16 w-14 shrink-0 overflow-hidden rounded-md border-2 transition", a.slug === slug ? "border-scan ring-2 ring-scan/30" : "border-transparent opacity-80 hover:opacity-100")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imageUrl} alt={a.title} className={cn("h-full w-full object-cover", a.sensitive.length > 0 && "blur-[6px]")} />
                </button>
              ))}
            </div>
            {art && <p className="mt-1 text-[13px] text-ink-2">{art.title}</p>}
          </fieldset>
        )}
        <Code code={code} lang="html" title="Paste where it should appear" />
        {footer}
      </div>
      <EmbedPreview attrs={attrs} iframe={kind === "iframe" ? `/embed/art/${encodeURIComponent(slug)}` : undefined} />
    </div>
  );
}
