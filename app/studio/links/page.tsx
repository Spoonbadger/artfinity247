import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import LinksEditor from "@/components/links/LinksEditor";
import { getLinksPage, getPickableArt } from "@/components/links/data";
import { LINK_SELECT } from "@/components/links/model";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Links" };

export default async function LinksStudioPage() {
  const artist = await requireArtist("/studio/links");
  const [links, art, page] = await Promise.all([
    prisma.artistLink.findMany({ where: { artistId: artist.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: LINK_SELECT }),
    getPickableArt(artist.id),
    getLinksPage(artist.slug),
  ]);
  if (!page) return null;

  return (
    <StudioPage
      title="Links"
      sub="One link for your bio. Socials, links, and your prints."
      actions={
        <Link href={`/@${artist.slug}/links`} target="_blank" className="btn btn-ghost btn-sm gap-1.5">
          Open my links <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
    >
      <LinksEditor initialLinks={links} initialTheme={page.theme} art={art} page={page} />
    </StudioPage>
  );
}
