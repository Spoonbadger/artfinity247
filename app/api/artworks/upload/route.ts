import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify } from 'jose'
import cloudinary from '@/lib/cloudinary'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'
import slugify from 'slugify'

const prisma = new PrismaClient()

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

    const result = await new Promise<void>((resolve, reject) => {
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
          },
          (err, result) => {
            if (err || !result) {
              console.error('❌ Cloudinary error:', err);
              return reject(err);
            }
            uploadedImageUrl = result.secure_url;
            console.log('✅ Uploaded to Cloudinary:', uploadedImageUrl);
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
        // wait for cloudinary upload_stream to call resolve()
      });

      stream.pipe(busboy);
    });

    const title = fields.title
    const slug = slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36).slice(-4) // To be unique
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
      },
    });

    const artist = await prisma.artist.findUnique({
      where: { id: payload.id as string },
      select: { slug: true },
    })

    return NextResponse.json({
      ...artwork,
      artistSlug: artist?.slug
    })
  } catch (err) {
    console.error('Upload error:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}

