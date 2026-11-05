// POST /api/admin/social/upload (multipart: file, postId) → { url, mediaType }
// Local dev storage for a rendered video (public/uploads/social). With Cloudinary set, the browser uploads straight
// to Cloudinary instead (/api/admin/social/sign), since Vercel caps request bodies at 4.5 MB.
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { MAX_VIDEO_BYTES, cloudinaryOn, saveLocalVideo } from "@/lib/social/storage";
import { bad, json } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  if (cloudinaryOn()) return bad("Uploads go straight to Cloudinary here. Reload the page and try again.", "use_cloudinary", 409);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const postId = String(form?.get("postId") ?? "");
  if (!(file instanceof Blob) || !file.size) return bad("The video didn't arrive. Render it again.", "media_missing");
  if (file.size > MAX_VIDEO_BYTES) return bad("That video is over 80 MB. Pick a shorter preset or the square format.", "media_too_big", 413);
  if (!(await prisma.socialPost.findUnique({ where: { id: postId }, select: { id: true } }))) return bad("That post was removed. Reload the page.", "post_not_found", 404);
  const type = file.type.split(";")[0];
  if (type !== "video/mp4" && type !== "video/webm") return bad("Videos must be MP4 or WebM.", "media_type");
  // the first bytes must look like the format it claims (MP4 "ftyp" box, WebM EBML header)
  const buf = Buffer.from(await file.arrayBuffer());
  const ok = type === "video/mp4" ? buf.subarray(4, 8).toString("latin1") === "ftyp" : buf.readUInt32BE(0) === 0x1a45dfa3;
  if (!ok) return bad("That file isn't a video we can post. Render it again.", "media_type");
  try {
    const url = await saveLocalVideo(buf, type === "video/mp4" ? "mp4" : "webm");
    return json({ url, mediaType: type });
  } catch (e) {
    console.error("[social] local video save failed", e);
    return bad("Couldn't save the video here (read-only disk?). Set the Cloudinary keys: see SOCIAL_SETUP.md.", "storage_unavailable", 500);
  }
}
