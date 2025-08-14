import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs"

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return new NextResponse("Not authenticated", { status: 401 });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    // Adjust this to your token shape:
    // try artistId, then userId, then sub
    const artistId =
      (payload as any).artistId ||
      (payload as any).id ||
      (payload as any).userId ||
      (payload as any).sub
    if (!artistId) return new NextResponse("Invalid token", { status: 401 });

    // 2) Read file
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return new NextResponse("Missing file", { status: 400 });

    if (!file.type.startsWith("image/")) {
      return new NextResponse("Invalid file type", { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3) Upload to Cloudinary
    const uploadResult: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "artfinity/profile",
          resource_type: "image",
          // eager, transformation, etc. can go here
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
      stream.end(buffer);
    });

    const url: string = uploadResult.secure_url;

    // 4) Save to DB
    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      data: { profileImage: url },
      select: { slug: true, profileImage: true },
    });

    return NextResponse.json({ artist }, { status: 200 });
  } catch (err) {
    console.error("POST /api/artists/profile-image failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
}