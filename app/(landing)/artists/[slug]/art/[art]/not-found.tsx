import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { BrushStroke } from "@/components/af/Brush";
import { artPath } from "@/lib/urls";

export default async function ArtNotFound() {
  const picks = await prisma.artwork
    .findMany({
      where: { status: "APPROVED", sensitive: { isEmpty: true }, slug: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { slug: true, title: true, imageUrl: true, artist: { select: { slug: true } } },
    })
    .catch(() => []);

  return (
    <>
      {/* the layout's header steps aside on /@handle paths */}
      <SiteHeader inPage />
    <div className="mx-auto grid max-w-[1000px] gap-10 px-4 py-12 sm:px-6 md:py-20">
      <div className="grid justify-items-center gap-4 text-center">
        {/* an empty frame on the wall */}
        <div className="grid h-40 w-32 place-items-center rounded-[3px] border-[10px] border-ink bg-gallery shadow-[0_14px_30px_-10px_rgba(21,22,27,.4)]">
          <span className="display text-[44px] text-ink-2">?</span>
        </div>
        <h1 className="display relative text-[44px] md:text-[60px]">
          This one&apos;s off the wall
          <BrushStroke className="mx-auto mt-1 h-3 w-48" />
        </h1>
        <p className="max-w-sm text-[17px] text-ink-2">The link may be old, or the artist took it down.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/art" className="btn btn-blue">Browse art</Link>
          <Link href="/artists" className="btn btn-ghost">Find an artist</Link>
        </div>
      </div>
      {picks.length > 0 && (
        <div className="grid gap-3">
          <h2 className="eyebrow text-center">New on Artfinity</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {picks.map((p) => (
              <li key={p.slug}>
                <Link href={artPath(p.artist.slug, p.slug!)} className="group grid gap-1.5 text-ink no-underline">
                  <div className="aspect-[4/5] overflow-hidden rounded-lg bg-gallery">
                    <Image src={p.imageUrl} alt={p.title} width={400} height={500} unoptimized={!p.imageUrl.startsWith("/")} className="h-full w-full object-cover" />
                  </div>
                  <b className="text-[14px] group-hover:underline">{p.title}</b>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    </>
  );
}
