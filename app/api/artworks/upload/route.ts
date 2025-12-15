import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { jwtVerify } from 'jose'
import cloudinary from '@/lib/cloudinary'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'
import slugify from 'slugify'

// You can delete this now if you want – we're using Cloudinary's result directly.
// async function checkImageModeration(imageUrl: string) { ... }

export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value;
  if (!token) return new NextResponse('Not authenticated', { status: 401 });

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    const stream = toNodeReadable(req.body as ReadableStream<any>);
    const busboy = Busboy({ headers: Object.fromEntries(req.headers) });

    const fields: Record<string, string> = {};
    let uploadedImageUrl = '';
    let moderationResult = { flagged: false, reason: null as string | null };

    await new Promise<void>((resolve, reject) => {
      busboy.on('file', (_fieldname, file, info) => {
        const filename =
          typeof info === 'object' && 'filename' in info
            ? String(info.filename)
            : 'unnamed';

        console.log('🖼️ file received:', filename);

        const cloudStream = cloudinary.uploader.upload_stream(
          {
            folder: 'artfinity',
            resource_type: 'image',
            public_id: filename.split('.')[0] || 'unnamed',
            // 👇 enable your Cloudinary moderation add-on (must be turned on in dashboard)
            moderation: 'aws_rek', // or 'google_vision_ai', 'imagga', etc.
          },
          (err, result) => {
            if (err || !result) {
              console.error('❌ Cloudinary error:', err);
              return reject(err);
            }

            uploadedImageUrl = result.secure_url;
            console.log('✅ Uploaded to Cloudinary:', uploadedImageUrl);

            // 🔍 Read moderation decision from Cloudinary
            const moderationArr =
              (Array.isArray((result as any).moderation)
                ? ((result as any).moderation as { status: string; kind?: string }[])
                : []) || [];

            const mod = moderationArr[0];

            if (mod) {
              const isRejected = mod.status === "rejected";
              moderationResult = {
                flagged: isRejected,
                reason: isRejected ? `auto:${mod.kind || "moderation"}` : null,
              };
              console.log("🔎 Moderation result:", mod);
            }
            resolve();
          }
        );

        file.pipe(cloudStream);
      });

      busboy.on('field', (name, value) => {
        fields[name] = value;
      });

      busboy.on('error', reject);
      busboy.on('finish', () => {
        // wait for upload_stream to call resolve()
      });

      stream.pipe(busboy);
    });

    const title = fields.title;
    const slug =
      slugify(title, { lower: true, strict: true }) +
      '-' +
      Date.now().toString(36).slice(-4); // To be unique

    // Use the moderation result from Cloudinary
    const { flagged, reason } = moderationResult;

    const artwork = await prisma.artwork.create({
      data: {
        title,
        slug,
        markupSmall: parseInt(fields.markupSmall) || 0,
        markupMedium: parseInt(fields.markupMedium) || 0,
        markupLarge: parseInt(fields.markupLarge) || 0,
        description: fields.description || '',
        imageUrl: uploadedImageUrl,
        artistId: payload.id as string,

        status: flagged ? "PENDING" : "APPROVED",
        flaggedReason: flagged ? reason : null,
        flaggedBy: flagged ? "AUTO" : null,
      },
    });

    const artist = await prisma.artist.findUnique({
      where: { id: payload.id as string },
      select: { slug: true },
    });

    return NextResponse.json({
      ...artwork,
      artistSlug: artist?.slug,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
