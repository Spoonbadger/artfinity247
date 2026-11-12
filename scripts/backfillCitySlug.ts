import { prisma } from "@/lib/prisma";
import { citySlugFor } from "@/lib/citySlug";

async function run() {
const artists = await prisma.artist.findMany({ where: { citySlug: '' } })

for (const a of artists) {
  await prisma.artist.update({
    where: { id: a.id },
    data: { citySlug: citySlugFor(a.city || '', a.state) },
  })
}
}
run().finally(() => prisma.$disconnect())
