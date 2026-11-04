import Link from "next/link";
import { Swatch } from "@/components/af/Brush";

export default function ArtistNotFound() {
  return (
    <section className="mx-auto grid max-w-[560px] justify-items-center gap-5 px-4 py-20 text-center sm:py-28">
      <div className="flex w-[220px] gap-2" aria-hidden="true">
        <Swatch color="#f7c8a8" className="h-10" />
        <Swatch color="var(--af-sticker)" className="h-10" />
        <Swatch color="#b8c4ff" className="h-10" />
      </div>
      <h1 className="display text-[44px] sm:text-[56px]">No artist here yet.</h1>
      <p className="text-[17px] text-ink-2">That handle isn&apos;t taken. It could be yours.</p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link href="/art" className="btn btn-ghost">Browse art</Link>
        <Link href="/register" className="btn btn-blue">Claim your page</Link>
      </div>
    </section>
  );
}
