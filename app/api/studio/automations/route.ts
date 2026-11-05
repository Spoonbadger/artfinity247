// GET/PUT /api/studio/automations  The signed-in artist's server-side automations.
// { newsletter: boolean }  "Draft a newsletter when I upload new work" (lib/newsletterAuto.ts), every plan.
// { digest: boolean }      the Monday weekly digest email (lib/digest.ts), on unless turned off.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { autoNewsletterOn, setAutoNewsletter } from "@/lib/newsletterAuto";
import { getPref, setPref } from "@/lib/artistPrefs";

export const dynamic = "force-dynamic";

async function state(artistId: string) {
  const [newsletter, digest] = await Promise.all([autoNewsletterOn(artistId), getPref<{ off?: boolean }>(artistId, "digest")]);
  return { newsletter, digest: digest.off !== true };
}

export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  return NextResponse.json(await state(user.id));
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (typeof body?.newsletter === "boolean") await setAutoNewsletter(user.id, body.newsletter);
  if (typeof body?.digest === "boolean") await setPref(user.id, "digest", { off: !body.digest });
  return NextResponse.json(await state(user.id));
}
