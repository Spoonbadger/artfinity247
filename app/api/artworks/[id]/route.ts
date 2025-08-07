import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromRequest } from '@/lib/auth'
import { jwtVerify } from 'jose'
import cloudinary from '@/lib/cloudinary'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'

const prisma = new PrismaClient()


export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
  ) {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const artwork = await prisma.artwork.findUnique({
        where: { id: params.id }
    })

    if (!artwork || artwork.artistId !== user.id) {
        return NextResponse.json({ error: 'Forbidden'}, { status: 403} )
    }

    await prisma.artwork.delete({
        where: { id: params.id }
    })
    
    return NextResponse.json({ success: true })
}


export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return new NextResponse('Not authenticated', { status: 401 })

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )

    const stream = toNodeReadable(req.body as ReadableStream<any>)
    const busboy = Busboy({ headers: Object.fromEntries(req.headers) })

    const fields: Record<string, string> = {}
    let uploadedImageUrl: string | null = null

    const done = new Promise<void>((resolve, reject) => {
      busboy.on('file', (_fieldname, file, info) => {
        const filename = typeof info === 'object' && 'filename' in info
          ? String(info.filename)
          : 'unnamed'

        const cloudStream = cloudinary.uploader.upload_stream(
          {
            folder: 'artfinity',
            public_id: filename.split('.')[0] || 'unnamed',
          },
          (err, result) => {
            if (err || !result) return reject(err)
            uploadedImageUrl = result.secure_url
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

    const artwork = await prisma.artwork.findUnique({
      where: { id: params.id }
    })

    if (!artwork || artwork.artistId !== payload.id)
      return new NextResponse('Forbidden', { status: 403 })

    const updated = await prisma.artwork.update({
      where: { id: params.id },
      data: {
        title: fields.title,
        description: fields.description,
        price: parseFloat(fields.price),
        imageUrl: uploadedImageUrl || artwork.imageUrl,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Editing error', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
