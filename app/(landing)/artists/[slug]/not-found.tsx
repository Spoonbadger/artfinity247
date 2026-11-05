import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import { Swatch } from "@/components/af/Brush";
import { getUserFromCookie } from "@/lib/auth";

export default async function ArtistNotFound() {
  const user = await getUserFromCookie().catch(() => null);
  return (
    <>
      {/* the layout's header steps aside on /@handle paths */}
      <SiteHeader inPage />
    <section className="mx-auto grid max-w-[560px] justify-items-center gap-5 px-4 py-20 text-center sm:py-28">
      <div className="flex w-[220px] gap-2" aria-hidden="true">
        <Swatch color="#f7c8a8" className="h-10" />
        <Swatch color="var(--af-sticker)" className="h-10" />
        <Swatch color="#b8c4ff" className="h-10" />
      </div>
      <h1 className="display text-[44px] sm:text-[56px]">No artist here yet.</h1>
      <p className="text-[17px] text-ink-2">There&apos;s no live page at this address. Check the spelling, or find the artist by name.{user ? "" : " If the handle is free, it could be yours."}</p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link href="/artists" className="btn btn-ghost">Find an artist</Link>
        <Link href="/art" className="btn btn-ghost">Browse art</Link>
        {user ? <Link href="/studio" className="btn btn-blue">Go to my Studio</Link> : <Link href="/register" className="btn btn-blue">Claim your page</Link>}
      </div>
      <p className="text-[14.5px] text-ink-2">
        Scanned a code that brought you here? <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">Tell us</Link> and we&apos;ll find the piece.
      </p>
    </section>
    </>
  );
}
