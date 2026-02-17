import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { jwtVerify } from "jose";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


export async function GET(req: Request) {
  try {
    const token = req.headers.get("cookie")?.match(/auth-token=([^;]+)/)?.[1];
    if (!token) return new NextResponse("Unauthorized", { status: 401 });

    await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    const timestamp = Math.round(Date.now() / 1000);

    const { searchParams } = new URL(req.url)
    const folder = searchParams.get("folder") || "artfinity"

    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        folder,
      },
      process.env.CLOUDINARY_API_SECRET!
    );

    return NextResponse.json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}