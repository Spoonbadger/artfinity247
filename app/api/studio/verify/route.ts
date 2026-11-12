// POST /api/studio/verify  { instagram?, website?, photo, note? }
// The signed-in artist asks Artfinity to verify them. Sets verification to PENDING, then the automatic checks run
// (lib/trust/verification.server.ts): when they all pass, the artist is verified right away; otherwise the request
// waits for an admin, with the reasons in /admin/verification. The artist only hears the generic status.
// POST { recheck: true }  Runs the checks again on the pending request (after adding the code to their site).
// GET returns the current status.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { resend } from "@/lib/resend";
import { parseEvidence, readEvidence } from "@/components/artist/verification";
import { raiseAlert } from "@/lib/alerts";
import { verificationAlert } from "@/lib/alertBuilders";
import { rateLimit } from "@/lib/rateLimit";
import { runAutoVerification } from "@/lib/trust/verification.server";

export const dynamic = "force-dynamic";

const select = { verification: true, verifiedAt: true, verificationRequestedAt: true, verificationEvidence: true, verificationNote: true } as const;

export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const a = await prisma.artist.findUnique({ where: { id: user.id }, select });
  if (!a) return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  return NextResponse.json({ ...a, verificationEvidence: readEvidence(a.verificationEvidence) });
}

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  // Each check fetches their site and may use a paid photo check: a few tries per 10 minutes.
  if (!rateLimit(`verify:${user.id}`, 6, 10 * 60_000)) return NextResponse.json({ error: "That's a lot of tries. Wait a few minutes.", code: "rate_limited" }, { status: 429 });

  if (body?.recheck === true) {
    const cur = await prisma.artist.findUnique({ where: { id: user.id }, select: { verification: true } });
    if (cur?.verification !== "PENDING") return NextResponse.json({ error: "There's no request to check.", code: "not_pending" }, { status: 409 });
    await runAutoVerification(user.id);
    const a = await prisma.artist.findUnique({ where: { id: user.id }, select });
    return NextResponse.json({ ...a, verificationEvidence: readEvidence(a?.verificationEvidence) });
  }

  const parsed = parseEvidence(body);
  if (parsed.error !== undefined) return NextResponse.json({ error: parsed.error, code: "missing_evidence" }, { status: 400 });

  const current = await prisma.artist.findUnique({ where: { id: user.id }, select: { verification: true, artist_name: true, name: true, slug: true } });
  if (!current) return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  if (current.verification === "VERIFIED") return NextResponse.json({ error: "You're already verified. The blue seal is on your page.", code: "already_verified" }, { status: 409 });

  const updated = await prisma.artist.update({
    where: { id: user.id },
    data: {
      verification: "PENDING",
      verificationRequestedAt: new Date(),
      verificationEvidence: parsed.evidence,
      verificationNote: null,
    },
    select,
  });

  // The automatic checks: verified right away when everything passes.
  const auto = await runAutoVerification(user.id);
  if (auto?.verified) {
    const done = await prisma.artist.findUnique({ where: { id: user.id }, select });
    return NextResponse.json({ ...done, verificationEvidence: readEvidence(done?.verificationEvidence) });
  }

  // Held: let the team know there's a request to review (logged locally).
  const name = current.artist_name || current.name;
  if (updated.verificationRequestedAt) await raiseAlert(verificationAlert(user.id, name, updated.verificationRequestedAt));
  await resend.emails
    .send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: process.env.ADMIN_NOTIFY_EMAIL || "hello@theartfinity.com",
      subject: `Verification request: ${name}`,
      text: `${name} (@${current.slug}) asked to be verified.\nReview: ${process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com"}/admin/verification`,
    })
    .catch(() => null);

  return NextResponse.json({ ...updated, verificationEvidence: readEvidence(updated.verificationEvidence) });
}
