import Link from "next/link";
import { PRO, pct, proPrice } from "@/lib/plans";
import StartInfinityButton from "./StartInfinityButton";

/** Share kit video section for Free artists: a still preview and a friendly way to Infinity. */
export default function VideoUpsell({ imageUrl, title }: { imageUrl: string; title: string }) {
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
      <div className="relative mx-auto aspect-[9/16] w-[150px] overflow-hidden rounded-2xl bg-ink sm:w-full" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-[2px]" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="#15161b" /></svg>
          </span>
        </span>
        <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-white">Infinity</span>
      </div>
      <div className="grid justify-items-start gap-3">
        <h3 className="display text-[28px] leading-none">Videos are an Infinity tool</h3>
        <p className="text-[15px] text-ink-2">A 10-second reel of “{title}”, made for you. Plus {pct(PRO.split)} of profit and automations.</p>
        <div className="flex flex-wrap gap-2">
          <StartInfinityButton included />
          <Link href="/studio/infinity#referrals" className="btn btn-ghost">Share, get 2 months free</Link>
        </div>
        <span className="text-[13px] text-ink-2">{proPrice()}/mo. Images, captions and links below stay free.</span>
      </div>
    </div>
  );
}
