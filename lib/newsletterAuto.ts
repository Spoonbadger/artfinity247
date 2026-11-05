// "Draft a newsletter when I upload new work" (Studio → Automations). Server only.
// After a batch upload's summary (lib/artworkLive.ts announceBatch), if the artist switched it on: a draft Newsletter
// with the new live pieces, and an email telling the artist it's ready to check and send. Nothing is sent to
// followers automatically. Uploads within a few days add to the same unsent draft instead of starting another.
// The on/off switch is stored with lib/artistPrefs ("auto-newsletter"), on every plan.
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";
import { getPref, setPref } from "@/lib/artistPrefs";
import { MAX_ARTWORKS } from "@/lib/newsletter";
import { activeFollowerCount } from "@/lib/followers";

const FROM = "Artfinity <notifications@theartfinity.com>";
const BASE = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const MERGE_DAYS = 3;

type AutoPref = { on?: boolean; lastDraftId?: string };

export async function autoNewsletterOn(artistId: string) {
  return (await getPref<AutoPref>(artistId, "auto-newsletter")).on === true;
}

export async function setAutoNewsletter(artistId: string, on: boolean) {
  await setPref<AutoPref>(artistId, "auto-newsletter", { on });
}

function draftCopy(first: string, titles: string[]) {
  const n = titles.length;
  return {
    subject: n === 1 ? `New work: ${titles[0]}` : `${n} new paintings`,
    body: `Hi,\n\nI just finished ${n === 1 ? `"${titles[0]}"` : "a few new pieces"} and wanted you to see ${n === 1 ? "it" : "them"} first.\n\nPrints are made to order and ship free in the US.\n\nThanks for following,\n${first}`,
  };
}

/** Creates (or adds to) the artist's draft for these new pieces. Returns the draft id, or null when it's off or nothing is live. Never throws. */
export async function draftNewsletterForUpload(artistId: string, artworkIds: string[]): Promise<string | null> {
  try {
    const pref = await getPref<AutoPref>(artistId, "auto-newsletter");
    if (pref.on !== true || !artworkIds.length) return null;
    const [artist, fresh] = await Promise.all([
      prisma.artist.findUnique({ where: { id: artistId }, select: { email: true, first_name: true, artist_name: true, name: true, closedAt: true } }),
      prisma.artwork.findMany({ where: { id: { in: artworkIds }, artistId, status: "APPROVED", slug: { not: null } }, orderBy: { createdAt: "asc" }, select: { id: true, title: true } }),
    ]);
    if (!artist || artist.closedAt || !fresh.length) return null;
    const first = artist.first_name || firstNameOf(artist.artist_name || artist.name);

    // Add to the last automatic draft if it's recent and still unsent.
    const prev = pref.lastDraftId
      ? await prisma.newsletter.findFirst({ where: { id: pref.lastDraftId, artistId, sentAt: null, createdAt: { gte: new Date(Date.now() - MERGE_DAYS * 86_400_000) } } })
      : null;
    const ids = Array.from(new Set([...(prev?.artworkIds ?? []), ...fresh.map((f) => f.id)])).slice(0, MAX_ARTWORKS);
    if (prev && ids.length === prev.artworkIds.length && ids.every((id, i) => id === prev.artworkIds[i])) return prev.id; // replayed summary
    const titles = (await prisma.artwork.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } }))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      .map((a) => a.title);
    const copy = draftCopy(first, titles);
    const draft = prev
      ? await prisma.newsletter.update({ where: { id: prev.id }, data: { artworkIds: ids, subject: copy.subject, body: copy.body }, select: { id: true } })
      : await prisma.newsletter.create({ data: { artistId, artworkIds: ids, subject: copy.subject, body: copy.body }, select: { id: true } });
    await setPref<AutoPref>(artistId, "auto-newsletter", { lastDraftId: draft.id });

    const followers = await activeFollowerCount(artistId);
    const url = `${BASE()}/studio/newsletter?id=${draft.id}`;
    const text =
      `Hi ${first},\n\n` +
      `${prev ? "We added your new work to the newsletter draft" : "We drafted a newsletter with your new work"}: ${titles.join(", ")}.\n\n` +
      `It goes to ${followers} ${followers === 1 ? "follower" : "followers"} once you send it. Nothing goes out until you do. Check the words, then hit Send:\n\n${url}\n\n` +
      `You can switch this off in Studio → Automations.`;
    await resend.emails
      .send({ from: FROM, to: artist.email, subject: prev ? "Your newsletter draft has new work" : "Your newsletter draft is ready", text, html: emailHtml(text) })
      .catch((err) => console.error("[newsletter:auto] email failed", err));
    console.log(`[newsletter:auto] ${prev ? "updated" : "created"} draft ${draft.id} for ${artistId} with ${ids.length} pieces`);
    return draft.id;
  } catch (err) {
    console.error("[newsletter:auto] failed", artistId, err);
    return null;
  }
}
