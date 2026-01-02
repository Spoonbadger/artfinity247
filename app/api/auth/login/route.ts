import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";
export const runtime = "nodejs";


export async function POST(req: Request) {
  try {
    const { email, password, remember = false } = await req.json();
    const emailTrim = (email || "").trim();

    if (!emailTrim || !password) {
      return NextResponse.json({ code: "missing_fields" }, { status: 400 });
    }

    // ⬇️ case-insensitive email lookup
    const artist = await prisma.artist.findFirst({
      where: { email: { equals: emailTrim, mode: "insensitive" } },
    });

    if (!artist || !artist.password) {
      return NextResponse.json({ code: "user_not_found" }, { status: 401 });
    }

    const isValid = await compare(password, artist.password);
    if (!isValid) {
      return NextResponse.json({ code: "bad_password" }, { status: 401 });
    }

    const jwtExpire = remember ? "30d" : "3h";
    const token = await new SignJWT({
      id: artist.id,
      email: artist.email,
      slug: artist.slug,
      role: artist.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(jwtExpire)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!));

    const response = NextResponse.json({
      message: "Logged in",
      artist: {
        id: artist.id,
        name: artist.name,
        slug: artist.slug,
        email: artist.email,
        role: artist.role.toUpperCase(),
      },
    });

    const cookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax" as const,
    };

    if (remember) {
      response.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: false, // localhost
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    } else {
      // session cookie (expires with browser session)
      response.cookies.set("auth-token", token, cookieBase);
    }

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ code: "server_error" }, { status: 500 });
  }
}
