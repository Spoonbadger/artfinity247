// Photo edits on an artwork upload (components/media/ImageEditor.tsx).
//
// GET  /api/uploads/edit?source=<preview url>
//   -> { width, height, original }  the full-resolution size the edits apply to (original = a private original exists)
// POST /api/uploads/edit  JSON { source, edits, replace? }
//   source   the untouched upload's preview URL (a fresh upload, or an artwork's image / stored edit source)
//   edits    lib/imageEdits.ts ImageEdits (crop, rotate, straighten angle, perspective corners)
//   replace  an earlier edit result of the same source to delete (re-editing before publishing)
//   -> { url, width, height, printable, printableSig, edits }  same shape as POST /api/uploads, so the artwork
//      routes trust the print sizes; `edits` (with `source`) goes on the artwork as imageEdits, or null when the
//      edits change nothing (then url = source).
// The edits run with sharp on the full-resolution private original (lib/imageEdits.server.ts), and the result goes
// through the normal pipeline (lib/uploadPipeline.ts): a new private original, a 1600px public preview, print sizes.
// The source upload is left alone, so "Reset edits" can go back to it.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { deleteUpload, inArtistFolder, readOriginalImage } from "@/lib/storage";
import { applyEdits, uprightSize } from "@/lib/imageEdits.server";
import { isIdentity, parseEdits, type StoredEdits } from "@/lib/imageEdits";
import { artistUploadTarget, processUpload } from "@/lib/uploadPipeline";
import { printableFor } from "@/lib/printSizes";
import { signPrintable } from "@/lib/printSign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type User = { id: string; slug?: string };

const err = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

/** The artist's own upload, or the image (or edit source) of one of their artworks. */
async function canUse(url: string, user: User) {
  if (inArtistFolder(url, user)) return true;
  const hit = await prisma.artwork.findFirst({
    where: { artistId: user.id, OR: [{ imageUrl: url }, { imageEdits: { path: ["source"], equals: url } }] },
    select: { id: true },
  });
  return !!hit;
}

/** Still needed by an artwork or an order? Then it stays. */
async function inUse(url: string) {
  const [art, src, ordered] = await Promise.all([
    prisma.artwork.count({ where: { imageUrl: url } }),
    prisma.artwork.count({ where: { imageEdits: { path: ["source"], equals: url } } }),
    prisma.orderItem.count({ where: { imageUrl: url } }),
  ]);
  return art + src + ordered > 0;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return err("Log in to edit photos.", "not_logged_in", 401);
  const source = req.nextUrl.searchParams.get("source") || "";
  if (!source || !(await canUse(source, user))) return err("That photo isn't yours.", "not_your_art", 403);
  const img = await readOriginalImage(source);
  if (!img) return err("We couldn't find that photo. Upload it again.", "reupload", 404);
  const { w, h } = await uprightSize(img.data).catch(() => ({ w: 0, h: 0 }));
  if (!w) return err("We couldn't read that photo. Upload it again.", "unreadable_image", 415);
  return NextResponse.json({ width: w, height: h, original: img.original }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return err("Log in to edit photos.", "not_logged_in", 401);
  if (!rateLimit(`photo-edit:${user.id}`, 40, 10 * 60_000)) return err("That's a lot of edits. Wait a minute and save again.", "rate_limited", 429);
  const body = await req.json().catch(() => null);
  const source = typeof body?.source === "string" ? body.source : "";
  const edits = parseEdits(body?.edits);
  if (!source) return err("No photo came through. Open the editor again.", "bad_request", 400);
  if (!edits) return err("Those edits didn't make sense. Reset and try again.", "bad_edits", 400);
  if (!(await canUse(source, user))) return err("That photo isn't yours.", "not_your_art", 403);

  const img = await readOriginalImage(source);
  if (!img) return err("We couldn't find the original. Upload it again.", "reupload", 404);

  // Tidy up an earlier edit of the same photo that nothing uses any more.
  const replace = typeof body?.replace === "string" ? body.replace : "";
  const tidy = async () => {
    if (!replace || replace === source || !inArtistFolder(replace, user)) return;
    if (!(await inUse(replace))) await deleteUpload(replace).catch(() => {});
  };

  try {
    if (isIdentity(edits)) {
      const { w, h } = await uprightSize(img.data);
      const printable = printableFor(w, h);
      await tidy();
      return NextResponse.json({ url: source, width: w, height: h, printable, printableSig: signPrintable(source, printable), edits: null });
    }
    const t0 = Date.now();
    const { w: sourceW, h: sourceH } = await uprightSize(img.data);
    const out = await applyEdits(img.data, edits);
    const saved = await processUpload(out.data, "edited.jpg", artistUploadTarget(user));
    console.info("[photo-edit]", JSON.stringify({ user: user.id, from: `${sourceW}x${sourceH}`, to: `${out.width}x${out.height}`, ms: Date.now() - t0, original: img.original }));
    await tidy();
    const stored: StoredEdits = { v: 1, source, sourceW, sourceH, ...edits };
    return NextResponse.json({ ...saved, edits: stored });
  } catch (e) {
    if ((e as Error)?.message === "too_big") return err("That's bigger than we can print. Crop a little more.", "too_big", 400);
    console.error("[photo-edit] failed", e);
    return err("Couldn't save your edits on our side. Try again in a moment.", "server_error", 500);
  }
}
