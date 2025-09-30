import { prisma } from "@/lib/prisma";
import slugify from 'slugify'

async function run() {
const artists = await prisma.artist.findMany({ where: { citySlug: '' } })

for (const a of artists) {
  await prisma.artist.update({
    where: { id: a.id },
    data: { citySlug: slugify(a.city || '', { lower: true, strict: true }) },
  })
}
  console.log('Backfill done:', artists.length)
}
run().finally(() => prisma.$disconnect())
