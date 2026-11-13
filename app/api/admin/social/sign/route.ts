// POST /api/admin/social/sign { postId } → { url, fields }  Signed direct upload to Cloudinary (resource_type video).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { cloudinaryOn, signVideoUpload } from "@/lib/social/storage";
import { bad, json } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  if (!cloudinaryOn()) return json({ local: true });
  const b = (await req.json().catch(() => ({}))) as { postId?: unknown };
  const postId = String(b.postId ?? "");
  if (!(await prisma.socialPost.findUnique({ where: { id: postId }, select: { id: true } }))) return bad("That post was removed. Reload the page.", "post_not_found", 404);
  return json(await signVideoUpload(postId));
}
