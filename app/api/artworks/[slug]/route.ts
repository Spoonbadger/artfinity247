import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import {  } from '@/lib/auth'
import { jwtVerify } from 'jose'
import cloudinary from '@/lib/cloudinary'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'


export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {

  try {
    const artwork = await prisma.artwork.findUnique({
      where: { slug: params.slug },
      select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          imageUrl: true,
          markupSmall: true,
          markupMedium: true,
          markupLarge: true,
          artistId: true,
          artist: {
            select: {
              id: true,
              slug: true,
              name: true,
              artist_name: true,
            },
          },
        },
      })


    if (!artwork) {
      return new NextResponse('Artwork not found', { status: 404 })
    }

    return NextResponse.json(artwork)
  } catch (err) {
    console.error('GET artwork failed', err)
    return new NextResponse('Server error', { status: 500 })
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } } // keeps same route file
) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return new NextResponse("Not authenticated", { status: 401 });

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    const idOrSlug = params.slug;

    // crude cuid-ish check; adjust if you use UUIDs
    const looksLikeId = /^c[0-9a-z]+$/i.test(idOrSlug) && idOrSlug.length >= 12;

    // resolve the artwork by id or slug
    const artwork = await prisma.artwork.findUnique({
      where: looksLikeId ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true, artistId: true },
    });

    if (!artwork) return new NextResponse("Artwork not found", { status: 404 });

    // token was signed with { id, email, slug }
    const currentArtistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub;

    if (String(artwork.artistId) !== String(currentArtistId)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    await prisma.artwork.delete({ where: { id: artwork.id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Delete failed:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}


export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return new NextResponse('Not authenticated', { status: 401 })

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )

    const currentArtistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub


    const stream = toNodeReadable(req.body as ReadableStream<any>)
    const busboy = Busboy({ headers: Object.fromEntries(req.headers) })

    const fields: Record<string, string> = {}
    let uploadedImageUrl: string | null = null

    const done = new Promise<void>((resolve, reject) => {
      busboy.on('file', (_fieldname, file, info) => {
        const filename =
          typeof info === 'object' && 'filename' in info
            ? String(info.filename)
            : 'unnamed'

        // Optional: same 18 MB guard as POST
        let totalBytes = 0
        file.on('data', (chunk) => {
          totalBytes += chunk.length
          if (totalBytes > 18 * 1024 * 1024) {
            file.unpipe()
            return reject(new Error('File too large, under 18 MB please'))
          }
        })

        const cloudStream = cloudinary.uploader.upload_stream(
          {
            folder: 'artfinity',
            public_id: filename.split('.')[0] || 'unnamed',
          },
          (err, result) => {
            if (err || !result) {
              // Treat "Empty file" as "no new image selected"
              if ((err as any).http_code === 400 && (err as any).message === 'Empty file') {
                console.log('No new file selected, keeping existing image.')
                return resolve()
              }

              return reject(err)
            }

            uploadedImageUrl = result.secure_url.replace(
              "/upload/",
              "/upload/f_auto,q_auto/"
            )
            resolve()
          }
        )

        file.pipe(cloudStream)
      })

      busboy.on('field', (name, value) => {
        fields[name] = value
      })

      busboy.on('error', reject)
      busboy.on('finish', resolve)

      stream.pipe(busboy)
    })

    await done

    console.log("uploadedImageUrl:", uploadedImageUrl)

    const artwork = await prisma.artwork.findUnique({
      where: { slug: params.slug }
    })
    // console.log("Artwork SLUG??: ", artwork)

    if (!artwork || String(artwork.artistId) !== String(currentArtistId)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (!artwork || artwork.artistId !== payload.id)
      return new NextResponse('Forbidden', { status: 403 })

    const updated = await prisma.artwork.update({
      where: { slug: params.slug },
      data: {
        title: fields.title ?? artwork.title,
        description: fields.description ?? artwork.description,
        markupSmall:
          fields.markupSmall !== undefined
            ? parseInt(fields.markupSmall, 10) || artwork.markupSmall
            : artwork.markupSmall,
        markupMedium:
          fields.markupMedium !== undefined
            ? parseInt(fields.markupMedium, 10) || artwork.markupMedium
            : artwork.markupMedium,
        markupLarge:
          fields.markupLarge !== undefined
            ? parseInt(fields.markupLarge, 10) || artwork.markupLarge
            : artwork.markupLarge,
        imageUrl: uploadedImageUrl || artwork.imageUrl,
      },
    })

    const artist = await prisma.artist.findUnique({
      where: { id: updated.artistId },
      select: { slug: true },
    })

    return NextResponse.json({
      ...updated,
      artistSlug: artist?.slug,
    })
  } catch (err) {
    console.error('Editing error', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
