import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO = process.env.CONTACT_EMAIL || "contact@theartfinity.com";
const TOPICS = ["order", "artist", "other"] as const;

// 5 messages per IP per 10 minutes.
const hits = new Map<string, { n: number; t: number }>();
function allowed(ip: string) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > 10 * 60_000) { hits.set(ip, { n: 1, t: now }); return true; }
  e.n++;
  return e.n <= 5;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** POST /api/contact {name, email, topic, message, website(honeypot)} → {ok} */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) return NextResponse.json({ ok: false, error: "Too many messages. Try again in a few minutes." }, { status: 429 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  // Bots fill the hidden field; pretend it worked.
  if (body?.website) return NextResponse.json({ ok: true });

  const name = String(body?.name ?? "").trim().slice(0, 100);
  const email = String(body?.email ?? "").trim().slice(0, 200);
  const message = String(body?.message ?? "").trim().slice(0, 5000);
  const topic = TOPICS.includes(body?.topic) ? body.topic : "other";

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Add your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Add an email we can reply to.";
  if (message.length < 10) errors.message = "Tell us a little more.";
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 });

  try {
    await resend.emails.send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: TO,
      replyTo: email,
      subject: `Contact (${topic}): ${name}`,
      html: `<p><b>${esc(name)}</b> &lt;${esc(email)}&gt; · ${topic}</p><p style="white-space:pre-wrap">${esc(message)}</p>`,
      text: `${name} <${email}> · ${topic}\n\n${message}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("contact send failed", err);
    return NextResponse.json({ ok: false, error: "Couldn’t send right now. Email us directly." }, { status: 500 });
  }
}
