"use client";
// Something threw while rendering a Studio page. The Studio menu stays (this renders inside the Studio layout),
// so the artist can try again or carry on elsewhere. Nothing they saved is lost.
import Link from "next/link";
import { useEffect } from "react";
import CrookedFrame from "@/components/browse/Crooked";

export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[studio]", error);
  }, [error]);
  return (
    <div className="mx-auto grid max-w-[1320px] justify-items-center gap-7 px-4 pb-16 pt-10 text-center sm:px-6 lg:px-10 lg:pt-14">
      <CrookedFrame stroke="var(--af-coral)">
        <svg viewBox="0 0 100 80" className="w-[70%]" aria-hidden="true">
          <path d="M18 30C14 14 36 6 52 12s36 4 34 22-8 30-30 32-34-18-38-36Z" fill="var(--af-coral)" />
          <circle cx="82" cy="62" r="5" fill="var(--af-coral)" />
          <circle cx="16" cy="64" r="3.5" fill="var(--af-coral)" />
        </svg>
      </CrookedFrame>
      <div className="grid justify-items-center gap-3">
        <h1 className="display text-[40px] sm:text-[52px]">Paint spilled.</h1>
        <p className="max-w-[48ch] text-[16px] text-ink-2">
          This page broke on our side, not yours. Nothing you saved is lost. Try again, or carry on from Studio home.
        </p>
        {error?.digest && <p className="text-[13px] text-ink-2">Ref {error.digest}</p>}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => reset()} className="btn btn-blue">Try again</button>
          <Link href="/studio" className="btn btn-ghost">Studio home</Link>
          <Link href="/help" className="btn btn-ghost">Help center</Link>
        </div>
        <p className="mt-2 text-[14.5px] text-ink-2">
          Keeps happening? <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">Tell us</Link>
          {error?.digest ? " and mention the ref above." : "."}
        </p>
      </div>
    </div>
  );
}
