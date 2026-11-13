// /collector/verify?t=<link token> — the emailed sign-in link lands here. One tap posts the token (a POST, so mail
// scanners that open links can't use it up); the API sets the collector-token cookie and saves any hearted piece.
import type { Metadata } from "next";
import Link from "next/link";
import { BrushStroke } from "@/components/af/Brush";
import { VerifyLink } from "@/components/collector/CollectorActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Open your collection", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function VerifyPage({ searchParams }: { searchParams: { t?: string } }) {
  const t = typeof searchParams.t === "string" ? searchParams.t : "";
  return (
    <div className="mx-auto grid max-w-[520px] justify-items-center gap-5 px-4 py-16 text-center sm:py-24">
      <h1 className="display relative text-[44px] sm:text-[56px]">
        Welcome back
        <BrushStroke className="mx-auto mt-1 h-3 w-40" />
      </h1>
      {t ? (
        <>
          <p className="text-[17px] text-ink-2">Tap below to open your collection on this device.</p>
          <VerifyLink token={t} />
        </>
      ) : (
        <>
          <p className="text-[17px] text-ink-2">This link is missing its code. Use the button in your email, or ask for a new link.</p>
          <Link href="/collector/sign-in" className="btn btn-blue">Get a new link</Link>
        </>
      )}
    </div>
  );
}
