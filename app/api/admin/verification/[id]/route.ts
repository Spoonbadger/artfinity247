// POST /api/admin/verification/:artistId  { action: "approve" | "decline" | "revoke", note? }
// Admin decision on an artist's verification. Emails the artist.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminGuard } from "@/lib/admin";
import { resend } from "@/lib/resend";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const denied = await adminGuard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { action?: string; note?: string } | null;
  const action = body?.action;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (action !== "approve" && action !== "decline" && action !== "revoke") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  if (action === "decline" && !note) return NextResponse.json({ error: "Add a note so the artist knows what to fix." }, { status: 400 });

  const artist = await prisma.artist.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, first_name: true, artist_name: true, name: true, slug: true, verification: true },
  });
  if (!artist) return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  if (action === "revoke" && artist.verification !== "VERIFIED") return NextResponse.json({ error: "This artist isn't verified." }, { status: 409 });

  const data =
    action === "approve"
      ? { verification: "VERIFIED" as const, verifiedAt: new Date(), verificationNote: note || null }
      : action === "decline"
        ? { verification: "REJECTED" as const, verifiedAt: null, verificationNote: note }
        : { verification: "REJECTED" as const, verifiedAt: null, verificationNote: note || "Verification was removed. Send new evidence to be checked again." };

  const updated = await prisma.artist.update({
    where: { id: artist.id },
    data,
    select: { id: true, verification: true, verifiedAt: true, verificationNote: true },
  });

  const first = artist.first_name || (artist.artist_name || artist.name).split(" ")[0];
  const mail =
    action === "approve"
      ? {
          subject: "You're verified on Artfinity",
          text: `Hi ${first},\n\nA person at Artfinity checked your evidence. Your page now shows the verified seal next to your name.\n\n${SITE}/@${artist.slug}\n\nArtfinity`,
        }
      : action === "decline"
        ? {
            subject: "Your Artfinity verification needs another look",
            text: `Hi ${first},\n\nWe couldn't verify you yet.\n\n${note}\n\nYou can send new evidence any time: ${SITE}/studio/verify\n\nArtfinity`,
          }
        : {
            subject: "Your Artfinity verification was removed",
            text: `Hi ${first},\n\nYour verified seal was removed.\n\n${data.verificationNote}\n\nSend new evidence here: ${SITE}/studio/verify\n\nArtfinity`,
          };

  await resend.emails.send({ from: "Artfinity <notifications@theartfinity.com>", to: artist.email, ...mail }).catch(() => null);

  return NextResponse.json({ artist: updated });
}
