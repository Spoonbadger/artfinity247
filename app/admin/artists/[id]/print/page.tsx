import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../../../_components/gate";
import { PageHead } from "../../../_components/ui";
import PrintCodes from "@/components/print/PrintCodes";
import { printablePieces } from "@/lib/printJob";
import { printPreset, type PresetParams } from "@/lib/printPreset";
import { artistIsPro } from "@/lib/qr/plan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print codes" };

// Admins print any artist's codes on the same screen artists use (POST /api/studio/print with artistId).
export default async function AdminPrintCodesPage({ params, searchParams }: { params: { id: string }; searchParams: PresetParams }) {
  await adminRoleOrRedirect(`/admin/artists/${params.id}/print`, "orders");
  const a = await prisma.artist.findUnique({ where: { id: params.id }, select: { id: true, name: true, artist_name: true, closedAt: true } });
  if (!a || a.closedAt) notFound();
  const name = a.artist_name || a.name || "This artist";
  const [{ pieces }, { preset, note }, pro] = await Promise.all([printablePieces(a.id), printPreset(a.id, searchParams), artistIsPro(a.id)]);
  return (
    <div className="grid gap-6">
      <PageHead back={{ href: `/admin/artists/${a.id}`, label: name }} title="Print codes" sub={`${name}'s pieces. Same sizes, papers and looks they see.`} />
      <PrintCodes pieces={pieces} preset={preset} pro={pro} note={note} forArtist={{ id: a.id, name }} />
    </div>
  );
}
