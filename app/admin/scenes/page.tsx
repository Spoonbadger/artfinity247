import type { Metadata } from "next";
import { adminOrRedirect } from "../_components/gate";
import { PageHead } from "../_components/ui";
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
      <PageHead
        title="Scenes"
        sub={catalog ? `Live: ${catalog.distinct} scenes from ${catalog.photos.length} photos${catalog.fixtures ? " (includes test fixtures)" : ""}` : "Live: procedural rooms (no photo scenes built)"}
      >
        <details className="text-[13.5px] text-ink-2">
          <summary className="cursor-pointer font-semibold">How this works</summary>
          <p className="mt-1 max-w-[70ch]">
            Mark the wall, the hanging point and something of known height. The compositor hangs prints at true size from these. Files:{" "}
            <code className="text-[13px]">scenes/photos</code> → <code className="text-[13px]">scenes/annotations</code> → <code className="text-[13px]">data/scenes.json</code>.
          </p>
        </details>
      </PageHead>
      <SceneAnnotator
        photos={photos.map((p) => ({ id: p.id, w: p.w, h: p.h, source: p.source, credit: p.credit }))}
        annotations={Object.fromEntries(anns)}
        arts={arts.map((a) => ({ slug: a.slug as string, title: a.title, imageUrl: a.imageUrl }))}
        writable={scenesWritable()}
      />
    </div>
  );
}
