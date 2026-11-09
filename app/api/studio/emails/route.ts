// The signed-in artist's automated email wording.
// GET  -> { templates: { [kind]: { subject, body, enabled, custom } } } (defaults filled in)
// PUT  { kind, subject, body, enabled } -> upsert by artist + kind
// DELETE ?kind= -> back to Artfinity's default (removes the artist's row)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard, getUserFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { DEFAULT_TEMPLATES, EMAIL_KINDS, EMAIL_LIMITS, isEmailKind } from "@/lib/artistEmails";

export const dynamic = "force-dynamic";

async function artistId() {
  const user = await getUserFromCookie();
  return user?.id ?? null;
}

export async function GET() {
  const id = await artistId();
  if (!id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const rows = await prisma.emailTemplate.findMany({ where: { artistId: id } });
  const templates = Object.fromEntries(
    EMAIL_KINDS.map((k) => {
      const r = rows.find((x) => x.kind === k);
      return [k, r ? { subject: r.subject, body: r.body, enabled: r.enabled, custom: true } : { ...DEFAULT_TEMPLATES[k], enabled: true, custom: false }];
    })
  );
  return NextResponse.json({ templates });
}

export async function PUT(req: Request) {
  const { user, denied } = await activeUserGuard(); // signed in, not paused or closed
  if (denied) return denied;
  const id = user.id;
  if (!rateLimit(`crm-tpl:${id}`, 60, 60_000)) return NextResponse.json({ error: "Slow down a little. Try again in a minute.", code: "rate_limited" }, { status: 429 });

  const input = await req.json().catch(() => ({}));
  if (!isEmailKind(input.kind)) return NextResponse.json({ error: "That email type doesn't exist. Refresh the page.", code: "invalid_input" }, { status: 400 });
  const subject = typeof input.subject === "string" ? input.subject.replace(/\s+/g, " ").trim() : "";
  const body = typeof input.body === "string" ? input.body.replace(/\r\n/g, "\n").trim() : "";
  const enabled = input.enabled !== false;
  if (!subject || !body) return NextResponse.json({ error: "Add a subject and a message.", code: "missing_content" }, { status: 400 });
  if (subject.length > EMAIL_LIMITS.subject) return NextResponse.json({ error: `Subject: ${EMAIL_LIMITS.subject} characters max.`, code: "too_long" }, { status: 400 });
  if (body.length > EMAIL_LIMITS.body) return NextResponse.json({ error: `Message: ${EMAIL_LIMITS.body} characters max.`, code: "too_long" }, { status: 400 });

  const t = await prisma.emailTemplate.upsert({
    where: { artistId_kind: { artistId: id, kind: input.kind } },
    create: { artistId: id, kind: input.kind, subject, body, enabled },
    update: { subject, body, enabled },
  });
  return NextResponse.json({ template: { kind: t.kind, subject: t.subject, body: t.body, enabled: t.enabled, custom: true, updatedAt: t.updatedAt } });
}

export async function DELETE(req: Request) {
  const { user, denied } = await activeUserGuard(); // signed in, not paused or closed
  if (denied) return denied;
  const id = user.id;
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isEmailKind(kind)) return NextResponse.json({ error: "That email type doesn't exist. Refresh the page.", code: "invalid_input" }, { status: 400 });
  await prisma.emailTemplate.deleteMany({ where: { artistId: id, kind } });
  return NextResponse.json({ template: { kind, ...DEFAULT_TEMPLATES[kind], enabled: true, custom: false } });
}
