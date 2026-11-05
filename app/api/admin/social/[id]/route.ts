// PATCH /api/admin/social/<id> { action, ... }
//   edit        { caption?, preset?, format?, headline? }  a new preset or format drops the rendered video
//   approve     { mediaUrl, mediaType }   after the admin's browser rendered and uploaded the video: schedules it
//   skip | restore | move { direction: up|down } | unschedule (back to draft, keeps the video)
//   mark_posted { permalink? }            manual mode: it was posted by hand
//   retry                                 failed → approved, due now
//   publish_now                           with Instagram keys: publish this approved post right away
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { resolveAlert } from "@/lib/alerts";
import { readSocialSettings } from "@/lib/social/settings";
import { reschedule } from "@/lib/social/admin";
import { igConfigured } from "@/lib/social/instagram";
import { postAlertKey, publishPost } from "@/lib/social/publish";
import { deleteLocalVideo, isOurCloudVideo } from "@/lib/social/storage";
import { isFormat, isPreset, presetOf } from "@/lib/social/presets";
import { whenNY } from "@/lib/social/schedule";
import { bad, json } from "../_lib";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCAL_VIDEO = /^\/uploads\/social\/[\w-]+\.(mp4|webm)$/;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  const b = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;
  const post = await prisma.socialPost.findUnique({ where: { id: params.id } });
  if (!post) return bad("That post was removed. Reload the page.", "post_not_found", 404);
  const action = String(b.action ?? "");
  const log = (what: string, summary: string, details?: Record<string, unknown>) => logAdminAction(admin, `social.${what}`, { type: "social", id: post.id }, summary, details);
  const label = post.caption.split("\n")[0].slice(0, 60);

  switch (action) {
    case "edit": {
      if (!["draft", "approved", "failed"].includes(post.status)) return bad("Posted and skipped posts can't be edited. Restore it first.", "not_editable", 409);
      const data: Record<string, unknown> = {};
      if (typeof b.caption === "string") {
        const caption = b.caption.trim();
        if (!caption) return bad("Write a caption first.", "caption_required");
        if (caption.length > 2200) return bad("Instagram captions stop at 2,200 characters.", "caption_too_long");
        data.caption = caption;
      }
      if (typeof b.headline === "string") data.headline = b.headline.trim().slice(0, 80) || null;
      const presetChanged = isPreset(b.preset) && b.preset !== post.preset;
      const formatChanged = isFormat(b.format) && b.format !== post.format;
      if (presetChanged) {
        if (presetOf(b.preset as never).pieces === "many" && post.artworkIds.length < 2) return bad("That look needs several pieces. Promote a collection or an artist instead.", "needs_more_art");
        data.preset = b.preset;
      }
      if (formatChanged) data.format = b.format;
      // the video no longer matches: back to draft, render again on approve
      if (presetChanged || formatChanged || typeof b.headline === "string") {
        if (post.mediaUrl) await deleteLocalVideo(post.mediaUrl);
        Object.assign(data, { mediaUrl: null, mediaType: null, status: "draft", scheduledFor: null, igContainerId: null });
      }
      await prisma.socialPost.update({ where: { id: post.id }, data });
      await log("edit", `Edited post “${label}”`, { fields: Object.keys(data) });
      if (post.status === "approved") await reschedule(await readSocialSettings());
      return json({ message: data.status === "draft" && post.status !== "draft" ? "Saved. Approve it again to render the new video." : "Saved" });
    }
    case "approve": {
      if (!["draft", "failed"].includes(post.status)) return bad("Only drafts can be approved.", "not_draft", 409);
      const mediaUrl = String(b.mediaUrl ?? "");
      const mediaType = String(b.mediaType ?? "");
      if (!(LOCAL_VIDEO.test(mediaUrl) || isOurCloudVideo(mediaUrl))) return bad("The video didn't upload. Render it again.", "media_missing");
      if (!/^video\/(mp4|webm)$/.test(mediaType)) return bad("Videos must be MP4 or WebM.", "media_type");
      if (post.artistId) {
        const a = await prisma.artist.findUnique({ where: { id: post.artistId }, select: { socialFeature: true } });
        if (!a?.socialFeature) return bad("This artist turned off social features. Skip this post.", "no_consent", 409);
      }
      if (post.mediaUrl && post.mediaUrl !== mediaUrl) await deleteLocalVideo(post.mediaUrl);
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "approved", mediaUrl, mediaType, approvedById: admin.id, approvedAt: new Date(), error: null, errorCode: null, igContainerId: null, scheduledFor: null } });
      await reschedule(await readSocialSettings());
      const after = await prisma.socialPost.findUnique({ where: { id: post.id }, select: { scheduledFor: true } });
      await resolveAlert(postAlertKey(post.id));
      await log("approve", `Approved post “${label}”${after?.scheduledFor ? ` for ${whenNY(after.scheduledFor)}` : ""}`, { mediaUrl, mediaType });
      const when = after?.scheduledFor ? whenNY(after.scheduledFor) : null;
      return json({ message: igConfigured() ? (when ? `Approved. It posts ${when}.` : "Approved") : `Approved. Post it by hand${when ? ` around ${when}` : ""}: download the video and copy the caption.`, scheduledFor: after?.scheduledFor ?? null });
    }
    case "skip": {
      if (!["draft", "approved", "failed"].includes(post.status)) return bad("This post can't be skipped now.", "not_skippable", 409);
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "skipped", scheduledFor: null } });
      await resolveAlert(postAlertKey(post.id));
      await log("skip", `Skipped post “${label}”`);
      if (post.status === "approved") await reschedule(await readSocialSettings());
      return json({ message: "Skipped. Find it under History to restore it." });
    }
    case "restore": {
      if (!["skipped", "failed"].includes(post.status)) return bad("Only skipped or failed posts can be restored.", "not_restorable", 409);
      const last = await prisma.socialPost.findFirst({ where: { status: { in: ["draft", "approved"] } }, orderBy: { position: "desc" }, select: { position: true } });
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "draft", scheduledFor: null, error: null, errorCode: null, igContainerId: null, position: (last?.position ?? 0) + 1 } });
      await resolveAlert(postAlertKey(post.id));
      await log("restore", `Restored post “${label}” to the queue`);
      return json({ message: "Back in the queue as a draft" });
    }
    case "unschedule": {
      if (post.status !== "approved") return bad("Only approved posts can go back to draft.", "not_approved", 409);
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "draft", scheduledFor: null } });
      await log("unschedule", `Moved post “${label}” back to draft`);
      await reschedule(await readSocialSettings());
      return json({ message: "Back to draft. The video is kept." });
    }
    case "move": {
      const dir = b.direction === "up" ? "up" : "down";
      const group = await prisma.socialPost.findMany({ where: { status: post.status === "approved" ? "approved" : "draft" }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, position: true } });
      const i = group.findIndex((g) => g.id === post.id);
      const j = dir === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= group.length) return json({ message: dir === "up" ? "Already first" : "Already last" });
      // renumber the group so equal positions can't stall a move
      const order = group.map((g) => g.id);
      [order[i], order[j]] = [order[j], order[i]];
      await prisma.$transaction(order.map((id, k) => prisma.socialPost.update({ where: { id }, data: { position: k + 1 } })));
      if (post.status === "approved") await reschedule(await readSocialSettings());
      await log("reorder", `Moved post “${label}” ${dir}`);
      return json({ message: dir === "up" ? "Moved up" : "Moved down" });
    }
    case "mark_posted": {
      if (!["approved", "failed", "draft"].includes(post.status)) return bad("This post is already done.", "not_open", 409);
      const permalink = typeof b.permalink === "string" && /^https:\/\/(www\.)?instagram\.com\//.test(b.permalink.trim()) ? b.permalink.trim() : null;
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "posted", postedAt: new Date(), postedBy: "manual", permalink, error: null, errorCode: null } });
      await resolveAlert(postAlertKey(post.id));
      await log("mark_posted", `Marked post “${label}” as posted by hand`, { permalink });
      if (post.status === "approved") await reschedule(await readSocialSettings());
      return json({ message: "Marked as posted" });
    }
    case "retry": {
      if (post.status !== "failed") return bad("Only failed posts can be retried.", "not_failed", 409);
      if (!post.mediaUrl) return bad("Render the video again first: open it and press Approve.", "media_missing", 409);
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "approved", scheduledFor: new Date(), error: null, errorCode: null, igContainerId: null } });
      await resolveAlert(postAlertKey(post.id));
      await log("retry", `Retrying post “${label}”`);
      return json({ message: igConfigured() ? "Queued to post on the next run (within the hour)" : "Back in the queue. Post it by hand." });
    }
    case "publish_now": {
      if (!igConfigured()) return bad("Instagram isn't connected, so posts go out by hand.", "instagram_not_connected", 409);
      if (post.status !== "approved" || !post.mediaUrl) return bad("Approve it first, so its video is rendered and uploaded.", "not_approved", 409);
      await log("publish_now", `Publishing post “${label}” now`);
      const r = await publishPost(post, 45_000);
      const after = await prisma.socialPost.findUnique({ where: { id: post.id }, select: { error: true, errorCode: true, permalink: true } });
      if (r === "failed") return json({ error: after?.error || "Instagram didn't take the post.", code: `ig_${after?.errorCode || "unknown"}` }, 502);
      return json({ message: r === "posted" ? "Posted to Instagram" : "Instagram is still processing the video. It will post on the next run.", permalink: after?.permalink ?? null });
    }
    default:
      return bad("Unknown action.");
  }
}
