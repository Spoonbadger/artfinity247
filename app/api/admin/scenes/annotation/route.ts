// POST /api/admin/scenes/annotation { annotation } : writes scenes/annotations/<id>.json. Admin only; dev only
// unless SCENES_ADMIN_WRITE=1 (the files live in the repo).
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";
import { findPhoto, writeAnnotation } from "@/lib/scenes/catalog";
import { scenesWritable } from "@/lib/scenes/server";
import type { SceneAnnotation } from "@/lib/scenes/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const isPt = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v));

export async function POST(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!scenesWritable()) return NextResponse.json({ error: "Annotations are saved in development only (or set SCENES_ADMIN_WRITE=1)." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { annotation?: SceneAnnotation } | null;
  const a = body?.annotation;
  if (!a || typeof a.id !== "string") return NextResponse.json({ error: "Missing annotation." }, { status: 400 });
  const photo = await findPhoto(a.id);
  if (!photo) return NextResponse.json({ error: "Unknown photo." }, { status: 404 });
  if (a.status !== "rejected") {
    if (!Array.isArray(a.quad) || a.quad.length !== 4 || !a.quad.every(isPt)) return NextResponse.json({ error: "Click the 4 wall corners." }, { status: 400 });
    if (!Array.isArray(a.anchors) || !a.anchors.length || !a.anchors.every(isPt)) return NextResponse.json({ error: "Set the anchor point." }, { status: 400 });
    if (!a.ref || !isPt(a.ref.a) || !isPt(a.ref.b) || !(Number(a.ref.inches) > 0)) return NextResponse.json({ error: "Draw a reference line and give its height." }, { status: 400 });
    if (a.ref2 && !(isPt(a.ref2.a) && isPt(a.ref2.b) && Number(a.ref2.inches) > 0)) a.ref2 = null;
  }
  try {
    const saved = await writeAnnotation({ ...a, image: { w: photo.w, h: photo.h } });
    await logAdminAction(admin, "scenes.annotate", { type: "scene", id: a.id }, `${a.status === "rejected" ? "Rejected" : "Annotated"} scene photo ${a.id}`, { status: a.status });
    return NextResponse.json({ annotation: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save." }, { status: 500 });
  }
}
