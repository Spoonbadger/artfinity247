// Where rendered social videos go, so Instagram can fetch them from a public URL. Server only.
// Production (CLOUDINARY_* set): the admin's browser uploads straight to Cloudinary with a signature from us, because
// a 10–15 MB video is over Vercel's 4.5 MB request limit. Cloudinary also turns a WebM into an MP4 on delivery.
// Local dev: the browser posts the file to /api/admin/social/upload, saved under public/uploads/social/.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { cloudinaryOn } from "@/lib/storage";
import { SITE_URL } from "@/lib/urls";

export const SOCIAL_FOLDER = "social";
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

export { cloudinaryOn };

/** Signed params for a direct browser upload to Cloudinary (resource_type video). */
export async function signVideoUpload(postId: string) {
  const cloudinary = (await import("@/lib/cloudinary")).default;
  const timestamp = Math.floor(Date.now() / 1000);
  const public_id = `${SOCIAL_FOLDER}/${postId}-${crypto.randomBytes(4).toString("hex")}`;
  const params = { public_id, timestamp };
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET as string);
  return {
    url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
    fields: { public_id, timestamp: String(timestamp), api_key: process.env.CLOUDINARY_API_KEY as string, signature },
  };
}

/** Only our own Cloudinary account's video URLs are accepted back from the browser. */
export function isOurCloudVideo(url: string) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  return !!cloud && url.startsWith(`https://res.cloudinary.com/${cloud}/video/upload/`) && url.includes(`/${SOCIAL_FOLDER}/`);
}

export async function saveLocalVideo(buf: Buffer, ext: "mp4" | "webm"): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads", SOCIAL_FOLDER);
  await fs.mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString("hex")}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return `/uploads/${SOCIAL_FOLDER}/${name}`;
}

/** The URL Instagram downloads: absolute, and MP4 (a Cloudinary WebM is converted on delivery). */
export function publicVideoUrl(url: string) {
  if (url.includes("res.cloudinary.com") && /\.webm(\?|$)/.test(url)) {
    return url.replace("/video/upload/", "/video/upload/f_mp4,vc_h264,ac_aac/").replace(/\.webm(\?|$)/, ".mp4$1");
  }
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Remove a local file we wrote (re-render replaces the video). Cloudinary copies are left for the history. */
export async function deleteLocalVideo(url: string | null | undefined) {
  if (!url || !url.startsWith(`/uploads/${SOCIAL_FOLDER}/`)) return;
  const file = path.join(process.cwd(), "public", url);
  if (!file.startsWith(path.join(process.cwd(), "public", "uploads", SOCIAL_FOLDER) + path.sep)) return;
  await fs.unlink(file).catch(() => {});
}
