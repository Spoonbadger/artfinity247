// The "social-publish" job (lib/jobs/registry.ts, /api/cron/social-publish, hourly): queues drafts for new art,
// checks the Instagram token, and publishes approved posts whose time has come. Server only.
//
// A Reel isn't ready the moment it's created: Meta downloads and processes the video. Each run waits up to ~40 s for
// a container; one still processing is left as "posting" and finished by the next run (containers last 24 hours).
// Failures (expired token, rate limit, bad media) mark the post failed, raise an admin alert with a fix link and go
// in the audit log.
import { prisma } from "@/lib/prisma";
import { raiseAlert, resolveAlert } from "@/lib/alerts";
import { logAdminAction } from "@/lib/audit";
import type { JobContext, JobResult } from "@/lib/jobs/run";
import { readSocialSettings } from "@/lib/social/settings";
import { autoQueueNewArt } from "@/lib/social/content";
import { IgError, containerStatus, createContainer, igConfigured, publishContainer, tokenHealth, type IgErrorKind } from "@/lib/social/instagram";
import { publicVideoUrl } from "@/lib/social/storage";

export const SOCIAL_JOB = "social-publish";
export const postAlertKey = (id: string) => `social_post_failed:${id}`;

/** Words and the page that fixes each kind of failure. */
export const FAILURE_FIX: Record<IgErrorKind, { title: string; fix: { label: string; href: string } }> = {
  token: { title: "Instagram token expired or was revoked", fix: { label: "Make a new token", href: "/admin/social/setup#token" } },
  rate_limit: { title: "Instagram's posting limit was hit", fix: { label: "Post fewer a day", href: "/admin/social#settings" } },
  media: { title: "Instagram couldn't use the video", fix: { label: "Render it again", href: "/admin/social#queue" } },
  config: { title: "The Instagram keys or permissions are wrong", fix: { label: "Check the setup", href: "/admin/social/setup" } },
  unknown: { title: "Instagram didn't take the post", fix: { label: "Try again", href: "/admin/social#queue" } },
};

type Post = { id: string; artistId: string | null; caption: string; mediaUrl: string | null; mediaType: string | null; igContainerId: string | null; approvedById: string | null; attempts: number; updatedAt: Date };

async function approver(p: Post) {
  if (!p.approvedById) return { id: "system", email: "social-publish job" };
  const a = await prisma.artist.findUnique({ where: { id: p.approvedById }, select: { email: true } }).catch(() => null);
  return { id: p.approvedById, email: a?.email ?? "" };
}

export async function failPost(p: Post, kind: IgErrorKind, message: string) {
  const meta = FAILURE_FIX[kind];
  await prisma.socialPost.update({ where: { id: p.id }, data: { status: "failed", error: message.slice(0, 500), errorCode: kind } });
  await raiseAlert({ kind: "social_post_failed", key: postAlertKey(p.id), title: `${meta.title}: ${message}`.slice(0, 200), link: `/admin/social?post=${p.id}#queue`, severity: kind === "token" ? "urgent" : "normal" });
  await logAdminAction(await approver(p), "social.publish_failed", { type: "social", id: p.id }, `Instagram post failed (${kind}): ${message}`, { kind, fix: meta.fix.href });
}

async function finish(p: Post, containerId: string) {
  const r = await publishContainer(containerId);
  await prisma.socialPost.update({ where: { id: p.id }, data: { status: "posted", postedAt: new Date(), postedBy: "instagram", igMediaId: r.mediaId, permalink: r.permalink, error: null, errorCode: null } });
  await resolveAlert(postAlertKey(p.id));
  await logAdminAction(await approver(p), "social.posted", { type: "social", id: p.id }, `Posted to Instagram${r.permalink ? `: ${r.permalink}` : ""}`, { mediaId: r.mediaId });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Creates (or picks up) the container, waits for it, publishes. Returns "posted", "processing" or "failed". */
export async function publishPost(p: Post, budgetMs = 40_000): Promise<"posted" | "processing" | "failed"> {
  try {
    let id = p.igContainerId;
    if (!id) {
      if (!p.mediaUrl) throw new IgError("The video hasn't been rendered and uploaded yet.", "media");
      id = await createContainer({ videoUrl: p.mediaType?.startsWith("image/") ? undefined : publicVideoUrl(p.mediaUrl), imageUrl: p.mediaType?.startsWith("image/") ? publicVideoUrl(p.mediaUrl) : undefined, caption: p.caption });
      await prisma.socialPost.update({ where: { id: p.id }, data: { status: "posting", igContainerId: id, attempts: { increment: 1 } } });
    }
    const until = Date.now() + budgetMs;
    for (;;) {
      const s = await containerStatus(id);
      if (s.code === "FINISHED") { await finish(p, id); return "posted"; }
      if (s.code === "PUBLISHED") { await prisma.socialPost.update({ where: { id: p.id }, data: { status: "posted", postedAt: new Date(), postedBy: "instagram" } }); return "posted"; }
      if (s.code === "ERROR") throw new IgError(`Instagram couldn't process the video${s.detail ? ` (${s.detail})` : ""}.`, "media");
      if (s.code === "EXPIRED") throw new IgError("The upload expired before it was published (24 hours).", "media");
      if (Date.now() > until) return "processing";
      await wait(5_000);
    }
  } catch (e) {
    const err = e instanceof IgError ? e : new IgError((e as Error)?.message || String(e), "unknown");
    // a container that failed is spent: the next try starts over
    await prisma.socialPost.update({ where: { id: p.id }, data: { igContainerId: null } }).catch(() => {});
    await failPost(p, err.kind, err.message);
    return "failed";
  }
}

const postSelect = { id: true, artistId: true, caption: true, mediaUrl: true, mediaType: true, igContainerId: true, approvedById: true, attempts: true, updatedAt: true } as const;

export async function runSocialJob(ctx: JobContext): Promise<JobResult> {
  const now = ctx.now;
  const s = await readSocialSettings();
  const auto = await autoQueueNewArt(s, now);
  const parts = [auto.queued ? `${auto.queued} new draft${auto.queued === 1 ? "" : "s"}` : "no new art"];
  const due = await prisma.socialPost.count({ where: { status: "approved", scheduledFor: { lte: now } } });
  if (!igConfigured()) return { summary: `Manual mode (no Instagram keys): ${parts.join(", ")}, ${due} due to post by hand`, details: { auto, due } };

  const health = await tokenHealth(now);
  parts.push(`token ${health.status}${health.refreshed ? " (refreshed)" : ""}`);
  if (health.status === "expired") return { ok: false, summary: `Instagram token expired: nothing posted (${parts.join(", ")})`, details: { auto, health } };
  if (!s.enabled) return { summary: `Auto-posting is off: ${parts.join(", ")}, ${due} approved post${due === 1 ? "" : "s"} due`, details: { auto, health, due } };

  const results: Record<string, string> = {};
  // finish anything still processing from the last run
  const processing = await prisma.socialPost.findMany({ where: { status: "posting", igContainerId: { not: null } }, select: postSelect, take: 3 });
  for (const p of processing) {
    if (now.getTime() - p.updatedAt.getTime() > 23 * 3_600_000) { await failPost(p, "media", "Instagram was still processing the video after 23 hours."); results[p.id] = "failed"; continue; }
    results[p.id] = await publishPost(p, 15_000);
  }
  // then the approved posts whose time has come (the schedule already spaces them per day)
  const ready = await prisma.socialPost.findMany({ where: { status: "approved", scheduledFor: { lte: now }, mediaUrl: { not: null } }, orderBy: [{ scheduledFor: "asc" }, { position: "asc" }], select: postSelect, take: 2 });
  for (const p of ready) {
    const consent = p.artistId ? await prisma.artist.findUnique({ where: { id: p.artistId }, select: { socialFeature: true, closedAt: true, suspendedAt: true } }) : null;
    if (p.artistId && (!consent || !consent.socialFeature || consent.closedAt || consent.suspendedAt)) {
      await prisma.socialPost.update({ where: { id: p.id }, data: { status: "skipped", error: "The artist turned off social features (or their account is closed).", errorCode: "consent" } });
      results[p.id] = "skipped (no consent)";
      continue;
    }
    results[p.id] = await publishPost(p);
  }
  const vals = Object.values(results);
  const n = (v: string) => vals.filter((x) => x === v).length;
  if (vals.length) parts.push(`${n("posted")} posted, ${n("processing")} processing, ${n("failed")} failed`);
  else parts.push("nothing due");
  return { summary: parts.join(", "), details: { auto, health, results } };
}
