import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { listRequests, shippedAtFor } from "@/lib/reprints";
import { helpDeadline } from "@/lib/reprintFormat";
import { sizeWords } from "@/lib/artistEmails";
import { adminOrRedirect } from "../_components/gate";
import ReprintsQueue, { type AdminReprint } from "../_components/ReprintsQueue";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reprints" };

const TABS = [
  { id: "open", label: "Open" },
  { id: "done", label: "Decided" },
] as const;

export default async function AdminReprintsPage({ searchParams }: { searchParams: { tab?: string } }) {
  await adminOrRedirect("/admin/reprints");
  const tab = TABS.find((t) => t.id === searchParams.tab)?.id ?? "open";

  const all = await listRequests(undefined, 300);
  const openCount = all.filter((r) => r.status === "open").length;
  const rows = tab === "open" ? all.filter((r) => r.status === "open").reverse() : all.filter((r) => r.status !== "open");

  const orders = rows.length
    ? await prisma.order.findMany({
        where: { id: { in: Array.from(new Set(rows.map((r) => r.orderId))) } },
        select: {
          id: true, email: true, shippingName: true, shippingAddress: true, shippingStatus: true, createdAt: true, amountTotal: true, kind: true,
          items: { select: { id: true, title: true, imageUrl: true, size: true, frameChosen: true, frameColor: true, quantity: true, editionNumber: true, artistName: true, artwork: { select: { editionSize: true } } } },
        },
      })
    : [];
  const byId = new Map(orders.map((o) => [o.id, o]));
  const shipped = new Map(await Promise.all(orders.map(async (o) => [o.id, await shippedAtFor(o.id)] as const)));

  const list: AdminReprint[] = rows.flatMap((r) => {
    const o = byId.get(r.orderId);
    if (!o) return [];
    const items = new Map(o.items.map((i) => [i.id, i]));
    return [{
      id: r.id,
      status: r.status,
      reason: r.body.reason,
      note: r.body.note,
      photos: r.body.photos,
      createdAt: r.createdAt.toISOString(),
      decision: r.body.decision ?? null,
      order: {
        id: o.id,
        email: o.email,
        name: o.shippingName || o.email,
        address: o.shippingAddress,
        date: o.createdAt.toISOString(),
        total: o.amountTotal,
        status: o.shippingStatus,
        kind: o.kind,
        shippedAt: shipped.get(o.id)?.toISOString() ?? null,
        deadline: helpDeadline(o, shipped.get(o.id) ?? null).toISOString(),
        month: o.createdAt.toISOString().slice(0, 7),
      },
      items: r.body.items.flatMap(({ id, qty }) => {
        const it = items.get(id);
        if (!it) return [];
        const ed = it.editionNumber && it.artwork?.editionSize ? ` · #${it.editionNumber} of ${it.artwork.editionSize}` : "";
        return [{
          id, qty, of: it.quantity ?? 1,
          title: it.title || "Print",
          imageUrl: it.imageUrl,
          detail: `${sizeWords(it.size) || it.size || ""}${it.frameChosen ? `, ${it.frameColor || ""} frame` : ""}${ed}`,
          artist: it.artistName || "",
        }];
      }),
    }];
  });

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">{openCount === 0 ? "All caught up" : `${openCount} waiting`}</p>
        <h1 className="display text-[44px] sm:text-[56px]">Reprints</h1>
        <p className="mt-1 max-w-[62ch] text-[14px] text-ink-2">Damaged, misprinted or wrong prints, sent by buyers with photos. Artfinity pays: a reprint is a free order and never touches the artist&apos;s sale or earnings.</p>
      </div>
      <nav aria-label="Reprint views" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "open" ? "/admin/reprints" : `/admin/reprints?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "rounded-full border-[1.5px] px-3.5 py-1.5 text-[14px] font-semibold no-underline transition",
              tab === t.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink",
            )}
          >
            {t.label}
            {t.id === "open" && openCount > 0 && <span className="num ml-1.5 rounded-full bg-coral px-1.5 text-[12px] text-white">{openCount}</span>}
          </Link>
        ))}
      </nav>
      <ReprintsQueue key={tab} requests={list} />
    </div>
  );
}
