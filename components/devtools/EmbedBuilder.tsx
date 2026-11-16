"use client";
// Pick an embed, tweak it, copy the snippet, see it live. Used on /developers and /studio/developers.
// Options stay folded behind one button; the preview is the real embed (embed.js or the iframe).
import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAINTS } from "@/components/artist/theme";
import { EMBED_DEFAULTS, estimateHeight, optionPairs, type EmbedOptions } from "@/lib/embed/options";
import Code from "./Code";
import EmbedPreview, { type EmbedAttrs } from "./EmbedPreview";
import {
  artistPath, buySnippet, cardPath, cardSnippet, collectionPath, collectionSnippet, galleryIframeSnippet, gallerySnippet, iframeSnippet, linksSnippet,
} from "./snippets";

export type Kind = "gallery" | "collection" | "card" | "buy" | "links";
export type PickArt = { slug: string; title: string; imageUrl: string; sensitive: string[] };
export type PickCollection = { slug: string; title: string; count: number };

export const KIND_LABEL: Record<Kind, string> = { gallery: "Gallery", collection: "Collection", card: "One piece", buy: "Buy button", links: "Link in bio" };

const COUNTS = [3, 4, 6, 8, 9, 12, 16, 24];

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink-2">{label}</label>
      {children(id)}
    </div>
  );
}

const selectCls = "min-h-[40px] w-full rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px]";

function Pick<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <Field label={label}>
      {(id) => (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => onChange(options.find(([v]) => String(v) === e.target.value)![0])}
          className={selectCls}
        >
          {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
        </select>
      )}
    </Field>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-[14px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--af-scan)]" />
      {label}
    </label>
  );
}

const attrsOf = (pairs: [string, string][]): EmbedAttrs => Object.fromEntries(pairs.map(([k, v]) => [`data-${k}`, v]));

export default function EmbedBuilder({
  handle, name, artworks, collections = [], kinds = ["gallery", "collection", "card", "buy", "links"], initialKind, initialSlug, stacked = false, footer,
}: {
  handle: string;
  /** The artist's public name, for iframe titles. */
  name?: string;
  artworks: PickArt[];
  collections?: PickCollection[];
  kinds?: Kind[];
  initialKind?: Kind;
  initialSlug?: string;
  /** Code above preview, even on wide screens. */
  stacked?: boolean;
  /** Shown under the code block. */
  footer?: ReactNode;
}) {
  const available = kinds.filter((k) => (k === "collection" ? collections.length > 0 : true));
  const [kind, setKind] = useState<Kind>(initialKind && available.includes(initialKind) ? initialKind : available[0]);
  const [o, setO] = useState<EmbedOptions>(EMBED_DEFAULTS);
  const [noScript, setNoScript] = useState(false);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(initialSlug || artworks[0]?.slug || "");
  const [colSlug, setColSlug] = useState(collections[0]?.slug || "");
  const set = <K extends keyof EmbedOptions>(k: K, v: EmbedOptions[K]) => setO((p) => ({ ...p, [k]: v }));
  const panelId = useId();

  const art = artworks.find((a) => a.slug === slug);
  const col = collections.find((c) => c.slug === colSlug);
  const who = name || handle;
  const gallery = kind === "gallery" || kind === "collection";
  const iframeOk = gallery || kind === "card";
  const asIframe = iframeOk && noScript;

  let code = "";
  let attrs: EmbedAttrs = {};
  let iframe: { src: string; height: number; width?: number } | undefined;
  if (kind === "gallery") {
    code = asIframe ? galleryIframeSnippet(artistPath(handle, o), `Art by ${who}`, o) : gallerySnippet(handle, o);
    attrs = { "data-artfinity-artist": handle, ...attrsOf(optionPairs(o)) };
    if (asIframe) iframe = { src: artistPath(handle, o), height: estimateHeight(o, 640, o.count) };
  } else if (kind === "collection") {
    const pieces = Math.min(col?.count ?? o.count, o.count);
    code = asIframe ? galleryIframeSnippet(collectionPath(handle, colSlug, o), `${col?.title ?? "Collection"} by ${who}`, o, pieces) : collectionSnippet(handle, colSlug, o);
    attrs = { "data-artfinity-collection": `${handle}/${colSlug}`, ...attrsOf(optionPairs(o)) };
    if (asIframe) iframe = { src: collectionPath(handle, colSlug, o), height: estimateHeight(o, 640, pieces) };
  } else if (kind === "card") {
    const co = { theme: o.theme, accent: o.accent };
    code = asIframe ? iframeSnippet(slug, art ? `${art.title} by ${who}` : "Artwork", co) : cardSnippet(slug, co);
    attrs = { "data-artfinity-art": slug, ...attrsOf(optionPairs(co)) };
    if (asIframe) iframe = { src: cardPath(slug, co), height: 460, width: 320 };
  } else if (kind === "buy") {
    code = buySnippet(slug);
    attrs = { "data-artfinity-buy": slug };
  } else {
    const t = o.theme === "dark" ? "dark" : undefined;
    code = linksSnippet(handle, t);
    attrs = { "data-artfinity-links": handle, "data-theme": t };
  }
  const needsArt = kind === "card" || kind === "buy";
  const hasOptions = kind !== "buy";
  const dark = o.theme === "dark";

  return (
    <div className={cn("grid min-w-0 gap-5", !stacked && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start")}>
      <div className="grid min-w-0 gap-4">
        <div className="flex flex-wrap items-end gap-3">
          {available.length > 1 && (
            <div className="min-w-[160px] flex-1">
              <Pick label="Embed" value={kind} onChange={setKind} options={available.map((k) => [k, KIND_LABEL[k]])} />
            </div>
          )}
          {kind === "collection" && collections.length > 1 && (
            <div className="min-w-[160px] flex-1">
              <Pick label="Collection" value={colSlug} onChange={setColSlug} options={collections.map((c) => [c.slug, c.title])} />
            </div>
          )}
          {hasOptions && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
              className="btn btn-ghost btn-sm min-h-[40px]"
            >
              Options <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} aria-hidden="true" />
            </button>
          )}
        </div>

        {hasOptions && open && (
          <div id={panelId} className="box-inset grid gap-3 p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {gallery && (
                <Pick label="Layout" value={o.layout} onChange={(v) => set("layout", v)} options={[["grid", "Grid"], ["carousel", "Carousel"], ["single", "One large"]]} />
              )}
              {gallery && o.layout !== "single" && (
                <Pick label="Pieces" value={o.count} onChange={(v) => set("count", v)} options={COUNTS.map((n) => [n, String(n)])} />
              )}
              {gallery && o.layout !== "single" && (
                <Pick
                  label={o.layout === "carousel" ? "Per view" : "Columns"}
                  value={o.columns}
                  onChange={(v) => set("columns", v)}
                  options={[[0, "Auto"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]]}
                />
              )}
              <Pick
                label="Theme"
                value={kind === "links" && o.theme === "auto" ? "light" : o.theme}
                onChange={(v) => set("theme", v)}
                options={kind === "links" ? [["light", "Light"], ["dark", "Dark"]] : [["light", "Light"], ["dark", "Dark"], ["auto", "Match visitor"]]}
              />
              {kind !== "links" && (
                <Pick
                  label="Button color"
                  value={o.accent ?? ""}
                  onChange={(v) => set("accent", v || null)}
                  options={[["", "My page color"], ...PAINTS.map((p): [string, string] => [p.id, p.name])]}
                />
              )}
            </div>
            {(gallery || iframeOk) && (
              <div className="flex flex-wrap gap-x-5">
                {gallery && <Check label="Prices" checked={o.prices} onChange={(v) => set("prices", v)} />}
                {gallery && <Check label="Header" checked={o.header} onChange={(v) => set("header", v)} />}
                {iframeOk && <Check label="Iframe only, no script" checked={noScript} onChange={setNoScript} />}
              </div>
            )}
          </div>
        )}

        {needsArt && artworks.length > 1 && (
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">Piece</legend>
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
      <EmbedPreview attrs={attrs} iframe={iframe} dark={dark} />
    </div>
  );
}
