import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import EmbedBuilder from "@/components/devtools/EmbedBuilder";
import Disclosure from "@/components/money/Disclosure";
import Code from "@/components/devtools/Code";
import { SITE } from "@/components/devtools/snippets";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Embed on your site" };

export default async function StudioDevelopersPage() {
  const artist = await requireArtist("/studio/developers");
  const live = { status: "APPROVED" as const, slug: { not: null } };
  const [rows, inReview, cols] = await Promise.all([
    prisma.artwork.findMany({
      where: { artistId: artist.id, ...live },
      orderBy: { createdAt: "desc" },
      select: { slug: true, title: true, imageUrl: true, sensitive: true },
    }),
    prisma.artwork.count({ where: { artistId: artist.id, status: "PENDING" } }),
    prisma.collection.findMany({
      where: { artistId: artist.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { slug: true, title: true, _count: { select: { items: { where: { artwork: live } } } } },
    }),
  ]);
  const arts = rows.map((r) => ({ ...r, slug: r.slug as string }));
  // Only collections with a live piece can be embedded (the rest are hidden on the public page too).
  const collections = cols.filter((c) => c._count.items > 0).map((c) => ({ slug: c.slug, title: c.title, count: c._count.items }));
  // Lead with a safe-for-work piece for the single-piece snippets.
  const first = arts.find((a) => !a.sensitive.length) ?? arts[0];
  const api = `${SITE}/api/public/v1/artists/${artist.slug}`;

  return (
    <StudioPage
      title="Embed on your site"
      sub="Sell prints from your own website."
      actions={<Link href="/developers" className="btn btn-ghost btn-sm">Developer docs <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
    >
      {arts.length ? (
        <section className="af-panel min-w-0 p-4 sm:p-6">
          <EmbedBuilder
            handle={artist.slug}
            name={artist.artist_name || artist.name}
            artworks={arts}
            collections={collections}
            initialSlug={first?.slug}
            footer={
              <p className="t-small">
                Paste it into an HTML block: Squarespace Code, Wix Embed HTML, WordPress Custom HTML. Buyers check out on Artfinity, so each sale pays your usual share.
              </p>
            }
          />
        </section>
      ) : (
        inReview ? (
          <EmptyState
            dab="#be778c"
            title="Your embeds appear once a piece is live"
            body={`${inReview === 1 ? "Your piece is" : `${inReview} pieces are`} in review, usually within a day. Then copy a gallery, a single piece or a buy button onto your own site.`}
            action={{ label: "See my art", href: "/studio/art" }}
            secondary={{ label: "Developer docs", href: "/developers" }}
          />
        ) : (
          <EmptyState
            dab="#be778c"
            title="Embeds appear once you have art"
            body="Upload a piece and copy a gallery, a single piece or a buy button onto your own site. Squarespace, Wix and WordPress all work."
            action={{ label: "Upload art", href: "/studio/art/new" }}
            secondary={{ label: "Developer docs", href: "/developers" }}
          />
        )
      )}

      <Disclosure title="For developers" hint="Your data as JSON · API keys">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="grid min-w-0 content-start gap-3" aria-labelledby="json-h">
            <h2 id="json-h" className="t-card">Your data, as JSON</h2>
            <p className="t-muted">Public and read-only. No key needed. Approved pieces only.</p>
            <Code
              lang="shell"
              title="Your endpoints"
              code={[`curl ${api}`, `curl ${api}/artworks`, `curl ${api}/collections`, `curl ${api}/events`].join("\n")}
            />
          </section>

          <section className="box-inset grid min-w-0 content-start gap-3 p-4" aria-labelledby="keys-h">
            <span className="sticker-badge justify-self-start">Coming with webhooks</span>
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-5 w-5 text-ink-2" aria-hidden="true" />
              <h2 id="keys-h" className="t-card">API keys</h2>
            </div>
            <p className="t-muted">Private keys come with sale webhooks, so your site can react when a print sells. Need one sooner? Tell us.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/contact" className="btn btn-ghost btn-sm">Ask for early access</Link>
              <Link href="/developers" className="btn btn-ghost btn-sm">Read the docs</Link>
            </div>
          </section>
        </div>
      </Disclosure>
    </StudioPage>
  );
}
