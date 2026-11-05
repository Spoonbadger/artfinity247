import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import EmbedBuilder from "@/components/devtools/EmbedBuilder";
import Code from "@/components/devtools/Code";
import { SITE } from "@/components/devtools/snippets";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Embed on your site" };

export default async function StudioDevelopersPage() {
  const artist = await requireArtist("/studio/developers");
  const [rows, inReview] = await Promise.all([
    prisma.artwork.findMany({
      where: { artistId: artist.id, status: "APPROVED", slug: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { slug: true, title: true, imageUrl: true, sensitive: true },
    }),
    prisma.artwork.count({ where: { artistId: artist.id, status: "PENDING" } }),
  ]);
  const arts = rows.map((r) => ({ ...r, slug: r.slug as string }));
  // Lead with a safe-for-work piece for the single-piece snippets.
  const first = arts.find((a) => !a.sensitive.length) ?? arts[0];
  const api = `${SITE}/api/public/v1/artists/${artist.slug}`;

  return (
    <StudioPage
      title="Embed on your site"
      sub="Copy, paste, sell prints from your own website."
      actions={<Link href="/developers" className="btn btn-ghost btn-sm">Developer docs <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
    >
      {arts.length ? (
        <section className="af-panel min-w-0 p-4 sm:p-6">
          <EmbedBuilder
            handle={artist.slug}
            artworks={arts}
            initialSlug={first?.slug}
            footer={
              <ol className="grid gap-2 text-[14px] text-ink-2">
                {[
                  ["var(--af-scan)", "Pick an embed, copy it."],
                  ["var(--af-sticker)", "Paste it into an HTML or code block on your site."],
                  ["var(--af-earned)", "Squarespace: Code block. Wix: Embed HTML. WordPress: Custom HTML."],
                ].map(([c, t], i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="paint-dab mt-1" style={{ ["--dab" as string]: c }} aria-hidden="true" />
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            }
          />
        </section>
      ) : (
        inReview ? (
          <EmptyState
            dab="#9aa0ff"
            title="Your embeds appear once a piece is live"
            body={`${inReview === 1 ? "Your piece is" : `${inReview} pieces are`} in review, usually within a day. Then copy a gallery, a single piece or a buy button onto your own site.`}
            action={{ label: "See my art", href: "/studio/art" }}
            secondary={{ label: "Developer docs", href: "/developers" }}
          />
        ) : (
          <EmptyState
            dab="#9aa0ff"
            title="Embeds appear once you have art"
            body="Upload a piece and copy a gallery, a single piece or a buy button onto your own site. Squarespace, Wix and WordPress all work."
            action={{ label: "Upload art", href: "/studio/art/new" }}
            secondary={{ label: "Developer docs", href: "/developers" }}
          />
        )
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="af-panel grid min-w-0 content-start gap-3 p-4 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="paint-dab" style={{ ["--dab" as string]: "var(--af-earned)" }} aria-hidden="true" />
            <h2 className="font-display text-[22px] font-extrabold [font-variation-settings:'wdth'_80]">Your data, as JSON</h2>
          </div>
          <p className="text-[14px] text-ink-2">Public, read-only, no key needed. Only approved pieces.</p>
          <Code
            lang="shell"
            title="Your endpoints"
            code={[`curl ${api}`, `curl ${api}/artworks`, `curl ${api}/collections`].join("\n")}
          />
        </section>

        <section className="relative grid min-w-0 content-start gap-3 overflow-hidden rounded-2xl border-[1.5px] border-dashed border-ink/40 bg-wall p-4 sm:p-6">
          <span className="sticker-badge justify-self-start">Coming with webhooks</span>
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-ink-2" aria-hidden="true" />
            <h2 className="font-display text-[22px] font-extrabold [font-variation-settings:'wdth'_80]">API keys</h2>
          </div>
          <p className="text-[14px] text-ink-2">Private keys arrive with sale webhooks, so your site can react when a print sells.</p>
          <p className="text-[14px] text-ink-2">Until then, the public JSON above covers your pieces and collections, no key needed. Building something that needs a key? Tell us and we&apos;ll get you in early.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/contact" className="btn btn-sm">Ask for early access</Link>
            <Link href="/developers" className="btn btn-ghost btn-sm">Read the docs</Link>
          </div>
        </section>
      </div>
    </StudioPage>
  );
}
