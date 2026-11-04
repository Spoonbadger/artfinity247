import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import AutomationsPanel from "@/components/pro/AutomationsPanel";
import ProChip from "@/components/pro/ProChip";
import { getArtistPlan } from "@/components/pro/plan.server";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const artist = await requireArtist("/studio/automations");
  const [plan, recent] = await Promise.all([
    getArtistPlan(artist.id),
    prisma.artwork.findMany({
      where: { artistId: artist.id, status: "APPROVED", slug: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { slug: true, title: true, imageUrl: true, createdAt: true },
    }),
  ]);

  return (
    <StudioPage
      title={<span className="inline-flex flex-wrap items-center gap-3">Automations <ProChip className="text-[13px]" /></span>}
      sub="Post once. Artfinity does the rest."
      actions={<Link href="/studio/pro" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Plan</Link>}
    >
      <AutomationsPanel
        pro={plan.active}
        storageKey={`af-automations:${artist.id}`}
        recent={recent.map((r) => ({ slug: r.slug as string, title: r.title, imageUrl: r.imageUrl, createdAt: r.createdAt.toISOString() }))}
      />
    </StudioPage>
  );
}
