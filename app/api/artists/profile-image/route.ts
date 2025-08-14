import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

const prisma = new PrismaClient();

cloudinary.config({
  // Prefer server-side vars; fall back to NEXT_PUBLIC if you really set only that
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    // auth
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return new NextResponse("Not authenticated", { status: 401 });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    // your login signs { id, email, slug }
    const artistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub;

    if (!artistId) return new NextResponse("Invalid token", { status: 401 });

    // file
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return new NextResponse("Missing file", { status: 400 });
    if (!file.type.startsWith("image/")) {
      return new NextResponse("Invalid file type", { status: 400 });
    }

    // optional size guard (10MB)
    if ((file as any).size && (file as any).size > 10 * 1024 * 1024) {
      return new NextResponse("File too large", { status: 413 });
    }

    // upload to Cloudinary (data URI avoids stream edge cases)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "artfinity/profile",
      resource_type: "image",
      overwrite: true,
      invalidate: true,
    });

    const url = result.secure_url as string;

    // save
    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      data: { profileImage: url },
      select: { slug: true, profileImage: true },
    });

    return NextResponse.json({ artist }, { status: 200 });
  } catch (err: any) {
    // make the actual error visible during dev
    console.error("POST /api/artists/profile-image failed:", {
      message: err?.message,
      name: err?.name,
      code: err?.http_code,
      stack: err?.stack,
    });
    return new NextResponse("Server error", { status: 500 });
  }
}