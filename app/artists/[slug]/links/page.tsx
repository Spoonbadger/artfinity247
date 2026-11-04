// Link-in-bio page: theartfinity.com/@handle/links (rewritten to /artists/:handle/links).
// Lives outside the (landing) group on purpose: full screen, no site header or footer.
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import LinkPage from "@/components/links/LinkPage";
import { getLinksPage } from "@/components/links/data";

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
  return <LinkPage data={data} />;
}
