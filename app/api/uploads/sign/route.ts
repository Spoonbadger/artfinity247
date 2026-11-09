// POST /api/uploads/sign  JSON { kind?: "photo", reviewOrder?, reviewToken?, helpOrder?, helpToken? }
// Step 1 of a device upload when Cloudinary is on: Vercel refuses request bodies over 4.5 MB, so the browser sends the
// file straight to Cloudinary with these signed parameters (components/media/uploadImage.ts), then calls
// POST /api/uploads/finish. Same people as POST /api/uploads: a signed-in artist, or a buyer with a signed review or
// help link. The signature pins the file to their folder, keeps it private and lasts an hour (lib/directUpload.ts).
// -> { url, fields, publicId, ticket, maxBytes }, or { local: true } without Cloudinary (then use POST /api/uploads).
import { NextRequest, NextResponse } from "next/server";
import { cloudinaryOn } from "@/lib/storage";
import { signImageUpload, uploaderFor, type UploaderInput } from "@/lib/directUpload.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!cloudinaryOn()) return NextResponse.json({ local: true });
  const b = ((await req.json().catch(() => null)) || {}) as UploaderInput;
  const who = await uploaderFor(b, true);
  if ("error" in who) return NextResponse.json({ error: who.error, code: who.code }, { status: who.status });
  try {
    return NextResponse.json(await signImageUpload(who.target), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[uploads/sign] failed", err);
    return NextResponse.json({ error: "Upload didn't go through on our side. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
