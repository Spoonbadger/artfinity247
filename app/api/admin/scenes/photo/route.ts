// GET /api/admin/scenes/photo?id=<id>&w=400 : a scene photo (or fixture) for the annotation tool. Admin only.
import { NextResponse } from "next/server";
import path from "node:path";
import fsp from "node:fs/promises";
import sharp from "sharp";
import { adminRoleGuard } from "@/lib/adminRoles";
import { findPhoto } from "@/lib/scenes/catalog";
import { sceneCacheDir } from "@/lib/scenes/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { denied } = await adminRoleGuard("admin"); // the Scenes tool: admin or owner
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const photo = await findPhoto(q.get("id") || "");
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const w = Math.min(2400, Math.max(0, Number(q.get("w")) || 0));
  const headers = { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" };
  const src = path.join(process.cwd(), photo.file);
  if (!w) {
    // upright, as the annotation points expect
    const buf = await sharp(src).rotate().jpeg({ quality: 88 }).toBuffer();
    return new NextResponse(new Uint8Array(buf), { headers });
  }
  const dir = await sceneCacheDir();
  const st = await fsp.stat(src);
  const thumb = dir ? path.join(dir, `thumb-${photo.id}-${w}-${Math.round(st.mtimeMs)}.jpg`) : null;
  if (thumb) {
    try {
      return new NextResponse(new Uint8Array(await fsp.readFile(thumb)), { headers });
    } catch {}
  }
  const buf = await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  if (thumb) fsp.writeFile(thumb, buf).catch(() => {});
  return new NextResponse(new Uint8Array(buf), { headers });
}
