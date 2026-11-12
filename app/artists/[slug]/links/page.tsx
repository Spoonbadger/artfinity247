// Link-in-bio page: theartfinity.com/@handle/links (rewritten to /artists/:handle/links).
// Lives outside the (landing) group on purpose: full screen, no site header or footer.
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import LinkPage from "@/components/links/LinkPage";
import { getLinksPage } from "@/components/links/data";
import ViewBeacon from "@/components/analytics/ViewBeacon";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#15161b" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getLinksPage(params.slug);
  if (!d) return { title: "Artist not found" };
  const description = d.bio ? d.bio.split(/(?<=[.!?])\s/)[0] : `Links and prints from ${d.name}.`;
  // Never put a sensitive piece in link previews.
  const bg = d.background && d.background.sensitive.length === 0 ? d.background : d.tiles.find((t) => t.sensitive.length === 0) ?? null;
  const image = bg?.imageUrl ?? d.avatar ?? undefined;
  const title = `${d.name} · Links`;
  return {
    metadataBase: new URL(SITE),
    title: { absolute: `${d.name} (@${d.slug}) · Links · Artfinity` },
    description,
    alternates: { canonical: `/@${d.slug}/links` },
    openGraph: {
      type: "profile",
      title,
      description,
      url: `/@${d.slug}/links`,
      siteName: "Artfinity",
      images: image ? [{ url: image, alt: bg ? `${bg.title}, by ${d.name}` : d.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function LinksRoute({ params }: Props) {
  const data = await getLinksPage(params.slug);
  if (!data) notFound();
  const [artist, user] = await Promise.all([
    prisma.artist.findUnique({ where: { slug: data.slug }, select: { id: true } }),
    getUserFromCookie().catch(() => null),
  ]);
  const owner = !!artist && user?.id === artist.id;
  const bare = data.links.length === 0;
  return (
    <>
      {artist && <ViewBeacon artistId={artist.id} />}
      <LinkPage data={data} />
      {owner && (
        // Only the artist sees this: what the page is missing and the way to the editor.
        <div role="note" className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[460px] flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-[1.5px] border-ink bg-white px-4 py-3 text-[14px] text-ink shadow-[4px_4px_0_#15161b]">
          <span className="min-w-0 flex-1">
            <b className="block">Only you see this bar.</b>
            {bare ? "Your page only has Shop my prints so far. Add your Instagram, website and other links." : "This is your links page, the way visitors see it."}
          </span>
          <Link href="/studio/links" className="inline-flex min-h-[40px] items-center rounded-full bg-scan px-4 text-[14px] font-bold text-white no-underline">
            {bare ? "Add your links" : "Edit links"}
          </Link>
        </div>
      )}
    </>
  );
}
