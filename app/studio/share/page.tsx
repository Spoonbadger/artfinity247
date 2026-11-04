import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import ShareKit from "@/components/share/ShareKit";
import { fromCents, type ShareArt } from "@/components/share/shareData";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Share kit" };

export default async function SharePage({ searchParams }: { searchParams: { art?: string } }) {
  const want = typeof searchParams.art === "string" ? searchParams.art : "";
  const artist = await requireArtist(`/studio/share${want ? `?art=${encodeURIComponent(want)}` : ""}`);

  const rows = await prisma.artwork.findMany({
    where: { artistId: artist.id, status: "APPROVED", slug: { not: null } },
    select: { slug: true, title: true, description: true, imageUrl: true, markupSmall: true, editionSize: true, sensitive: true },
    orderBy: { createdAt: "desc" },
  });
  const name = displayName(artist);
  const arts: ShareArt[] = rows.map((r) => ({
    slug: r.slug as string,
    title: r.title,
    artist: name,
    handle: artist.slug,
    city: artist.city || null,
    description: r.description || "",
    imageUrl: r.imageUrl,
    fromCents: fromCents(r.markupSmall),
    editionSize: r.editionSize ?? null,
    sensitive: r.sensitive ?? [],
  }));

  if (!arts.length) {
    return (
      <StudioPage title="Share kit" sub="Videos, posts and links that sell prints.">
        <div className="af-panel grid justify-items-start gap-3 p-6">
          <h2 className="display text-[28px]">No approved art yet</h2>
          <p className="text-[15px] text-ink-2">Your share kit appears once a piece is approved.</p>
          <Link href="/studio/art" className="btn btn-blue">Go to my art</Link>
        </div>
      </StudioPage>
    );
  }

  const slug = arts.some((a) => a.slug === want) ? want : arts[0].slug;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";

  return (
    <StudioPage title="Share kit" sub="Post it anywhere. Every piece leads to the print.">
      <ShareKit arts={arts} initialSlug={slug} base={base} />
    </StudioPage>
  );
}
