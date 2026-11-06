"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrushStroke } from "@/components/af/Brush";
import { SortMenu, useSortPref } from "@/components/studio/SortMenu";
import VideoStudio from "./videos/VideoStudio";
import { Captions, EmbedKit, ImageAssets, ShareLinks } from "./Assets";
import { dollars, type ShareArt } from "./shareData";

// One tab at a time keeps the page short. Tabs follow the URL hash, so links like #images still land right.
const SECTIONS = [
  { id: "video", label: "Videos", sub: "6 to 15 seconds for Reels, TikTok and Shorts.", dab: "#ff5a36" },
  { id: "images", label: "Images", sub: "Story and post images, each with a QR code.", dab: "#ffd43b" },
  { id: "captions", label: "Captions", sub: "Copy, paste, post.", dab: "#2b37f0" },
  { id: "links", label: "Links", sub: "One link per channel, so you can see what sells.", dab: "#0f7a55" },
  { id: "embed", label: "Embed", sub: "For your site or email signature.", dab: "#7b2d8e" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const isSection = (v: string): v is SectionId => SECTIONS.some((s) => s.id === v);

const PIECE_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "best", label: "Best selling" },
] as const;
type PieceSort = (typeof PIECE_SORTS)[number]["value"];
const PIECE_SORT_KEYS = PIECE_SORTS.map((s) => s.value);

export default function ShareKit({ arts, initialSlug, base, pro = true }: { arts: ShareArt[]; initialSlug: string; base: string; pro?: boolean }) {
  const [slug, setSlug] = useState(initialSlug);
  const art = arts.find((a) => a.slug === slug) ?? arts[0];
  const rowRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<SectionId>("video");
  const [pieceSort, setPieceSort] = useSortPref<PieceSort>("share.pieces", "newest", PIECE_SORT_KEYS);
  // The server sends newest first; best selling re-orders by prints sold.
  const pieces = useMemo(() => (pieceSort === "best" ? arts.slice().sort((a, b) => (b.sold ?? 0) - (a.sold ?? 0)) : arts), [arts, pieceSort]);
  const current = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0];

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (isSection(h)) setTab(h);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const pick = (id: SectionId) => {
    setTab(id);
    const u = new URL(window.location.href);
    u.hash = id === "video" ? "" : id;
    window.history.replaceState(null, "", u.toString());
  };

  // On phones the thumbnails scroll sideways: bring the chosen one into view (without moving the page).
  useEffect(() => {
    const row = rowRef.current, el = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && el && row.scrollWidth > row.clientWidth) row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("art") !== art.slug) { u.searchParams.set("art", art.slug); window.history.replaceState(null, "", u.toString()); }
  }, [art.slug]);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      {/* which piece */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="t-card">Which piece?</h2>
          {arts.length > 1 && <SortMenu label="Sort pieces" value={pieceSort} onChange={setPieceSort} options={[...PIECE_SORTS]} />}
        </div>
        <div ref={rowRef} className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Artwork">
          {pieces.map((a) => (
            <button
              key={a.slug}
              type="button"
              aria-pressed={a.slug === art.slug}
              onClick={() => setSlug(a.slug)}
              className={cn(
                "grid w-[92px] shrink-0 content-start gap-1.5 rounded-md p-1 text-left transition",
                a.slug === art.slug ? "bg-ink/5 ring-2 ring-ink" : "hover:bg-ink/5",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.imageUrl} alt="" loading="lazy" className="aspect-square w-full rounded-[3px] border-[3px] border-white object-cover shadow-[0_1px_4px_rgba(21,22,27,.25)]" />
              <span className="line-clamp-2 text-[13px] font-semibold leading-tight">{a.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* chosen piece */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="display relative w-max max-w-full text-[24px] sm:text-[28px]">
            <span className="relative z-10">{art.title}</span>
            <BrushStroke className="absolute -bottom-1 -left-2 z-0 h-3 w-[calc(100%+16px)]" />
          </p>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Prints from {dollars(art.fromCents)}{art.editionSize ? ` · Limited edition of ${art.editionSize}` : ""}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4">
        <div role="tablist" aria-label="Share kit" className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={tab === s.id}
              aria-controls="share-panel"
              onClick={() => pick(s.id)}
              className={cn(
                "-mb-px inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-b-[3px] px-3 text-[15px] font-semibold",
                tab === s.id ? "border-ink text-ink" : "border-transparent text-ink-2 hover:text-ink",
              )}
            >
              <span className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: s.dab }} aria-hidden="true" /> {s.label}
            </button>
          ))}
        </div>
        <Panel id={current.id} labelledBy={`tab-${current.id}`} sub={current.sub}>
          {tab === "video" && <VideoStudio art={art} arts={arts} base={base} pro={pro} />}
          {tab === "images" && <ImageAssets art={art} />}
          {tab === "captions" && <Captions art={art} base={base} />}
          {tab === "links" && (
            <>
              <ShareLinks art={art} base={base} />
              <Link href="/studio/links" className="group flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-ink/30 px-4 py-3 hover:border-ink">
                <span className="grid leading-tight">
                  <b className="text-[15px]">Add it to your links page</b>
                  <span className="text-[13px] text-ink-2">One link in bio for everything you sell.</span>
                </span>
                <ArrowRight size={18} className="shrink-0 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </>
          )}
          {tab === "embed" && <EmbedKit art={art} base={base} />}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ id, labelledBy, sub, children }: { id: string; labelledBy: string; sub: string; children: ReactNode }) {
  return (
    <section id="share-panel" role="tabpanel" aria-labelledby={labelledBy} data-section={id} className="grid min-w-0 gap-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
      <p className="text-[14px] text-ink-2">{sub}</p>
      {children}
    </section>
  );
}
