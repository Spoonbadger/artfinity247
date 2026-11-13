// POST   /api/admin/scanning/items/[itemId]  multipart { file, artworkId? }  Puts a scan file onto the painting's artwork
//        through the normal upload pipeline: replaces its image, re-measures its print sizes (lib/scanning.server.ts deliverScan).
// DELETE /api/admin/scanning/items/[itemId]  Undo: puts the previous image back.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { UnreadableImage, UPLOAD_ERRORS } from "@/lib/uploadPipeline";
import { deliverScan, SCAN_MAX_BYTES, ScanError, undoScan } from "@/lib/scanning.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const fail = (err: unknown, what: string) => {
  if (err instanceof ScanError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  if (err instanceof UnreadableImage) return NextResponse.json({ error: UPLOAD_ERRORS.unreadable, code: "unreadable_image" }, { status: 415 });
  console.error(`[scanning] ${what} failed`, err);
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
};

export async function POST(req: NextRequest, { params }: { params: { itemId: string } }) {
  const { admin, denied } = await adminRoleGuard("orders");
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file came through. Pick it again." }, { status: 400 });
  if (file.size > SCAN_MAX_BYTES) return NextResponse.json({ error: `That file is over ${Math.round(SCAN_MAX_BYTES / 1024 / 1024)} MB. Export a JPG or a smaller TIFF.` }, { status: 413 });
  if (file.type && !/^image\//.test(file.type)) return NextResponse.json({ error: UPLOAD_ERRORS.notImage }, { status: 415 });
  try {
    const r = await deliverScan(params.itemId, Buffer.from(await file.arrayBuffer()), file.name, admin, String(form?.get("artworkId") ?? "") || null);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return fail(err, "scan upload");
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const { admin, denied } = await adminRoleGuard("orders");
  if (denied) return denied;
  try {
    await undoScan(params.itemId, admin);
    return NextResponse.json({ ok: true, message: "Previous image put back." });
  } catch (err) {
    return fail(err, "scan undo");
  }
}
