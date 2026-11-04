"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrushStroke } from "@/components/af/Brush";
import VideoMaker from "./VideoMaker";
import VideoUpsell from "@/components/pro/VideoUpsell";
import { Captions, EmbedKit, ImageAssets, ShareLinks } from "./Assets";
import { dollars, type ShareArt } from "./shareData";

const SECTIONS = [
  { id: "video", label: "Video", dab: "#ff5a36" },
  { id: "images", label: "Images", dab: "#ffd43b" },
  { id: "captions", label: "Captions", dab: "#2b37f0" },
  { id: "links", label: "Links", dab: "#0f7a55" },
  { id: "embed", label: "Embed", dab: "#7b2d8e" },
] as const;

function Section({ id, title, sub, dab, children }: { id: string; title: string; sub?: string; dab: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 grid gap-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="paint-dab translate-y-[1px]" style={{ ["--dab" as string]: dab }} />
        <h2 id={`${id}-h`} className="display text-[30px] sm:text-[34px]">{title}</h2>
        {sub && <p className="w-full text-[14px] text-ink-2 sm:w-auto">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

export default function ShareKit({ arts, initialSlug, base, pro = true }: { arts: ShareArt[]; initialSlug: string; base: string; pro?: boolean }) {
  const [slug, setSlug] = useState(initialSlug);
  const art = arts.find((a) => a.slug === slug) ?? arts[0];
  const rowRef = useRef<HTMLDivElement>(null);

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
    <div className="grid min-w-0 gap-6">
      {/* which piece */}
      <div className="grid min-w-0 gap-2">
        <h2 className="text-[17px] font-extrabold">Which piece?</h2>
        <div ref={rowRef} className="relative -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="group" aria-label="Artwork">
          {arts.map((a) => (
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
              <span className="line-clamp-2 text-[12.5px] font-semibold leading-tight">{a.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* chosen piece + jump links */}
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
        <nav aria-label="Share kit sections" className="flex max-w-full flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13.5px] font-semibold hover:border-ink">
              <span className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: s.dab }} /> {s.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="video" title="Auto video" sub="Vertical, 10 seconds. Reels, TikTok, Shorts." dab="#ff5a36">
        {/* Auto videos are a Pro tool (lib/plans.ts). */}
        {pro ? <VideoMaker art={art} base={base} /> : <VideoUpsell imageUrl={art.imageUrl} title={art.title} />}
      </Section>

      <Section id="images" title="Story and post images" sub="Each one has a QR code to this piece." dab="#ffd43b">
        <ImageAssets art={art} />
      </Section>

      <Section id="captions" title="Captions" sub="Copy, paste, post." dab="#2b37f0">
        <Captions art={art} base={base} />
      </Section>

      <Section id="links" title="Links" sub="Each channel gets its own link, so you can see what sells." dab="#0f7a55">
        <ShareLinks art={art} base={base} />
        <Link href="/studio/links" className="group flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-ink/30 px-4 py-3 hover:border-ink">
          <span className="grid leading-tight">
            <b className="text-[15px]">Add this to your links page</b>
            <span className="text-[13px] text-ink-2">One link in bio for everything you sell.</span>
          </span>
          <ArrowRight size={18} className="shrink-0 transition group-hover:translate-x-0.5" />
        </Link>
      </Section>

      <Section id="embed" title="Embed" sub="Your site, blog or email." dab="#7b2d8e">
        <EmbedKit art={art} base={base} />
      </Section>
    </div>
  );
}
