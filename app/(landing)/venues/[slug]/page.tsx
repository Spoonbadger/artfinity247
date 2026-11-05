import type { Metadata } from "next";
import { previewImage, sharePreview } from "@/lib/og";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ScanLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SITE_URL, artistPath } from "@/lib/urls";
import PageHead, { EmptyCanvas } from "@/components/browse/PageHead";
import { ArtGrid } from "@/components/browse/ArtCard";
import { hangingAt, mapsUrl } from "@/lib/venues";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

const loadVenue = (slug: string) =>
  prisma.venue.findFirst({ where: { slug: decodeURIComponent(slug), active: true }, select: { id: true, name: true, slug: true, neighborhood: true, address: true } });

const headline = (v: { name: string; neighborhood: string | null }) => `Art at ${v.name}${v.neighborhood ? `, ${v.neighborhood}` : ""}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await loadVenue(params.slug).catch(() => null);
  if (!v) return { title: "Venue" };
  const title = headline(v);
  const description = `Prints of the art hanging at ${v.name}${v.neighborhood ? ` in ${v.neighborhood}` : ""}, by local artists. Scan the code beside each piece, or buy here.`;
  // The first piece on the wall that isn't sensitive.
  const { artworks } = await hangingAt(v.id).catch(() => ({ artworks: [] as Awaited<ReturnType<typeof hangingAt>>["artworks"] }));
  const image = previewImage(...artworks.map((a) => ({ url: a.imageUrl, alt: `${a.title}, by ${a.artist.name}`, sensitive: a.sensitive })));
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: `/venues/${v.slug}` },
    ...sharePreview({ title, description, url: `/venues/${v.slug}`, image }),
  };
}

export default async function VenuePage({ params }: Props) {
  const v = await loadVenue(params.slug);
  if (!v) notFound();
  const { artworks, artistPages } = await hangingAt(v.id);
  const artists = Array.from(new Set(artworks.map((a) => a.artist.name)));

  return (
    <div className="pb-20">
      <PageHead
        eyebrow="Artfinity partner venue"
        title={headline(v)}
        stroke="var(--af-sticker)"
        sub={artworks.length ? <>{artworks.length} {artworks.length === 1 ? "piece" : "pieces"} on the walls now{artists.length ? <> by {artists.join(", ")}</> : null}.</> : undefined}
      >
        <div className="grid max-w-[340px] gap-2 text-[15px]">
          {v.address && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
              <span>{v.address}</span>
            </p>
          )}
          <a href={mapsUrl(v)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm w-fit">
            Open in Google Maps<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </PageHead>

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <p className="mb-6 flex items-start gap-2.5 rounded-xl bg-sticker px-4 py-3 text-[15px] font-semibold text-ink sm:w-fit">
          <ScanLine className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          Scan the code beside any piece to buy a print.
        </p>

        {artworks.length ? (
          <section aria-labelledby="walls-h">
            <h2 id="walls-h" className="sr-only">On the walls now</h2>
            <ArtGrid art={artworks} />
          </section>
        ) : (
          <EmptyCanvas title="New art is on its way">
            <p className="text-ink-2">The walls at {v.name} are between shows. Check back soon.</p>
          </EmptyCanvas>
        )}

        {artistPages.length > 0 && (
          <p className="mt-10 text-[15px] text-ink-2">
            Also hanging here: work by{" "}
            {artistPages.map((a, i) => (
              <span key={a.slug}>
                {i > 0 && (i === artistPages.length - 1 ? " and " : ", ")}
                <Link href={artistPath(a.slug)} className="font-semibold text-ink underline underline-offset-2">{a.name}</Link>
              </span>
            ))}
            .
          </p>
        )}

        <p className="mt-12 text-[14px] text-ink-2">
          <Link href="/venues" className="font-semibold text-ink underline underline-offset-2">More places to see local art</Link>
        </p>
      </div>
    </div>
  );
}
