import type { Metadata } from "next";
import { adminOrRedirect } from "../_components/gate";
import SceneAnnotator from "../_components/SceneAnnotator";
import { listPhotos, loadCatalog, readAllAnnotations } from "@/lib/scenes/catalog";
import { scenesWritable } from "@/lib/scenes/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scenes" };

export default async function ScenesAdminPage() {
  await adminOrRedirect("/admin/scenes");
  const [photos, anns, arts] = await Promise.all([
    listPhotos({ fixtures: true }),
    readAllAnnotations(),
    prisma.artwork
      .findMany({ where: { status: "APPROVED", slug: { not: null } }, select: { slug: true, title: true, imageUrl: true }, orderBy: { createdAt: "desc" }, take: 16 })
      .catch(() => []),
  ]);
  const catalog = loadCatalog();
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-[34px] leading-none">Photo scenes</h1>
          <p className="mt-1 max-w-[760px] text-[14px] text-ink-2">
            Mark the wall, the hanging point and something of known height in each photo. The compositor uses these to hang any print at true size. Files:{" "}
            <code className="text-[13px]">scenes/photos</code> → <code className="text-[13px]">scenes/annotations</code> → <code className="text-[13px]">data/scenes.json</code>.
          </p>
        </div>
        <p className="text-[13px] text-ink-2">
          {catalog ? `Live: ${catalog.distinct} distinct scenes from ${catalog.photos.length} photos${catalog.fixtures ? " (includes test fixtures!)" : ""}` : "Live: procedural rooms (no photo scenes built)"}
        </p>
      </div>
      <SceneAnnotator
        photos={photos.map((p) => ({ id: p.id, w: p.w, h: p.h, source: p.source, credit: p.credit }))}
        annotations={Object.fromEntries(anns)}
        arts={arts.map((a) => ({ slug: a.slug as string, title: a.title, imageUrl: a.imageUrl }))}
        writable={scenesWritable()}
      />
    </div>
  );
}
