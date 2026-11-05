import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import FollowersTabs from "@/components/followers/FollowersTabs";
import NewsletterComposer, { type ComposerDraft } from "@/components/followers/NewsletterComposer";
import { followerCounts } from "@/lib/followers";
import { nextSendAt } from "@/lib/newsletter.server";
import { MAX_ARTWORKS } from "@/lib/newsletter";
import { SITE_URL } from "@/lib/urls";
import { displayName, firstName, requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Newsletter" };

const BASE = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, "");

// ?id= opens a draft. ?from=new starts one from work added since the last newsletter (Automations links here).
export default async function NewsletterPage({ searchParams }: { searchParams: { id?: string; from?: string } }) {
  const artist = await requireArtist("/studio/newsletter");
  const [counts, next, artworks, sent, drafts] = await Promise.all([
    followerCounts(artist.id),
    nextSendAt(artist.id),
    prisma.artwork.findMany({
      where: { artistId: artist.id, status: "APPROVED", slug: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, slug: true, title: true, imageUrl: true, createdAt: true },
    }),
    prisma.newsletter.findMany({ where: { artistId: artist.id, sentAt: { not: null } }, orderBy: { sentAt: "desc" }, take: 20 }),
    prisma.newsletter.findMany({ where: { artistId: artist.id, sentAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const first = firstName(artist);
  const draft = searchParams.id ? drafts.find((d) => d.id === searchParams.id) ?? null : null;
  let initial: ComposerDraft | null = draft ? { id: draft.id, subject: draft.subject, body: draft.body, artworkIds: draft.artworkIds } : null;
  if (!initial && searchParams.from === "new") {
    const since = sent[0]?.sentAt ?? new Date(0);
    const fresh = artworks.filter((a) => a.createdAt > since).slice(0, MAX_ARTWORKS);
    const pick = fresh.length ? fresh : artworks.slice(0, 1);
    initial = {
      id: null,
      subject: pick.length === 1 ? `New work: ${pick[0].title}` : pick.length ? `${pick.length} new paintings` : "",
      body: pick.length
        ? `Hi,\n\nI just finished ${pick.length === 1 ? `"${pick[0].title}"` : "a few new pieces"} and wanted you to see ${pick.length === 1 ? "it" : "them"} first.\n\nPrints are made to order and ship free in the US.\n\nThanks for following,\n${first}`
        : "",
      artworkIds: pick.map((a) => a.id),
    };
  }

  return (
    <StudioPage title="Newsletter" sub="Show new work to the people who asked for it.">
      <FollowersTabs active="/studio/newsletter" />
      <NewsletterComposer
        key={initial?.id ?? searchParams.from ?? "blank"}
        initial={initial}
        artist={{ name: displayName(artist), firstName: first, handle: artist.slug ?? "", avatar: artist.profileImage, email: artist.email }}
        artworks={artworks.map((a) => ({ id: a.id, slug: a.slug as string, title: a.title, imageUrl: a.imageUrl }))}
        recipients={counts.confirmed}
        nextSendAt={next?.toISOString() ?? null}
        base={BASE}
        drafts={drafts.map((d) => ({ id: d.id, subject: d.subject || "Untitled draft", createdAt: d.createdAt.toISOString() }))}
        sent={sent.map((n) => ({ id: n.id, subject: n.subject, sentAt: n.sentAt!.toISOString(), recipients: n.recipients, pieces: n.artworkIds.length }))}
      />
    </StudioPage>
  );
}
