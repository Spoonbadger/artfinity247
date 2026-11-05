import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import ShareKit from "@/components/share/ShareKit";
import { fromCents, type ShareArt } from "@/components/share/shareData";
import { requireArtist, displayName } from "../_lib/data";
import { getArtistPlan } from "@/components/pro/plan.server";

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
    const pending = await prisma.artwork.count({ where: { artistId: artist.id, status: "PENDING" } });
    return (
      <StudioPage title="Share kit" sub="Videos, posts and links that sell prints.">
        <EmptyState
          title={pending ? "Your share kit is almost ready" : "No approved art yet"}
          body={
            pending ? (
              <>
                {pending === 1 ? "Your piece is" : `${pending} pieces are`} waiting on a quick review. Once approved, each one gets story and post images with a QR code,
                captions to copy, tracked links for every channel and a website widget, right here.
              </>
            ) : (
              <>Add a piece and once it&apos;s approved, this fills with story and post images with a QR code, captions to copy, tracked links for every channel and a website widget.</>
            )
          }
          action={pending ? { label: "See my art", href: "/studio/art" } : { label: "Add your first piece", href: "/studio/art/new" }}
          secondary={{ label: "Share your page link", href: "/studio/links" }}
          help={{ label: "What's in the Share kit", href: "/help/growing/share-kit" }}
        />
      </StudioPage>
    );
  }

  const slug = arts.some((a) => a.slug === want) ? want : arts[0].slug;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
  const plan = await getArtistPlan(artist.id);

  return (
    <StudioPage title="Share kit" sub="Post it anywhere. Every piece leads to the print.">
      <ShareKit arts={arts} initialSlug={slug} base={base} pro={plan.active} />
    </StudioPage>
  );
}
