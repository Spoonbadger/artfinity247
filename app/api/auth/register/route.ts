// POST /api/auth/register
// Creates an artist account from the short sign-up flow and signs them in.
// Body: { handle, email, password, artist_name, city, state? }
// Errors: { code: "missing_fields" | "invalid_email" | "weak_password" | "invalid_handle" | "handle_taken" | "email_taken" | "server_error" }
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { SignJWT } from "jose";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import NewArtistNotificationEmail from "@/emails/NewArtistNotificationEmail";
import WelcomeArtistEmail from "@/emails/WelcomeArtistEmail";
import { checkHandle, normalizeHandle } from "../_lib/handle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const err = (code: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ code, ...extra }, { status });

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return err("missing_fields", 400); }

  const handle = normalizeHandle(String(body.handle ?? ""));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const artist_name = String(body.artist_name ?? "").trim().slice(0, 60);
  const city = String(body.city ?? "").trim().slice(0, 60);
  const state = String(body.state ?? "").trim().slice(0, 40) || null;

  if (!handle || !email || !password || !artist_name || !city) return err("missing_fields", 400);
  if (!EMAIL_RE.test(email)) return err("invalid_email", 400);
  if (password.length < 8) return err("weak_password", 400);

  const hc = await checkHandle(handle);
  if (!hc.available) return err(hc.reason === "invalid" ? "invalid_handle" : "handle_taken", hc.reason === "invalid" ? 400 : 409, { suggestions: hc.suggestions });

  const existing = await prisma.artist.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (existing) return err("email_taken", 409);

  let artist;
  try {
    artist = await prisma.artist.create({
      data: {
        name: artist_name,
        artist_name,
        email,
        password: await hash(password, 10),
        phone: "",
        city,
        citySlug: slugify(city, { lower: true, strict: true }),
        state,
        country: body.country ? String(body.country).slice(0, 60) : null,
        slug: handle,
        role: "USER",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta as any)?.target ?? "");
      return err(target.includes("email") ? "email_taken" : "handle_taken", 409);
    }
    console.error("REGISTER_FAIL", e);
    return err("server_error", 500);
  }

  const token = await new SignJWT({ id: artist.id, slug: artist.slug, email: artist.email, role: artist.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

  const res = NextResponse.json({ artist: { id: artist.id, slug: artist.slug, name: artist.artist_name } }, { status: 201 });
  res.cookies.set("auth-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  // Emails never block sign-up.
  try {
    await resend.emails.send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: "contact@theartfinity.com",
      subject: `New artist: ${artist_name} (@${handle})`,
      react: NewArtistNotificationEmail({ artistName: artist_name, email, city, state: state ?? "", createdAt: new Date().toLocaleString() }),
    });
    await resend.emails.send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: email,
      subject: "Welcome to Artfinity",
      react: WelcomeArtistEmail({ artistName: artist_name }),
    });
  } catch (e) {
    console.error("REGISTER_EMAIL_FAIL", e);
  }

  return res;
}
