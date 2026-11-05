import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { artPath } from "@/lib/urls";
import { StudioPage } from "@/components/studio/StudioPage";
import { requireArtist, STUDIO_TZ, usd } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "My purchases" };

const SIZE: Record<string, string> = { S: "Small", M: "Medium", L: "Large", XL: "XL", small: "Small", medium: "Medium", large: "Large", xl: "XL" };

// Prints this artist bought from other artists (matched by account email).
export default async function PurchasesPage() {
  const artist = await requireArtist("/studio/purchases");
  const items = await prisma.orderItem.findMany({
    where: { order: { email: { equals: artist.email, mode: "insensitive" } } },
    orderBy: { order: { createdAt: "desc" } },
    select: {
      id: true, slug: true, size: true, quantity: true, lineTotal: true, title: true, artistName: true, imageUrl: true,
      order: { select: { createdAt: true, shippingStatus: true } },
      artwork: { select: { slug: true, artist: { select: { slug: true } } } },
    },
  });

  return (
    <StudioPage title="My purchases" sub="Prints you've bought on Artfinity.">
      {items.length === 0 ? (
        <div className="af-panel grid justify-items-start gap-3 p-6">
          <p className="text-[15px] text-ink-2">Nothing yet. Support another artist.</p>
          <Link href="/art" className="btn btn-blue btn-sm">Browse art</Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((i) => (
            <li key={i.id} className="af-panel flex items-center gap-4 p-3">
              {i.imageUrl ? <img src={i.imageUrl} alt={i.title || "Artwork"} className="h-16 w-14 shrink-0 rounded object-cover" /> : <span className="h-16 w-14 shrink-0 rounded bg-wall" />}
              <div className="min-w-0 flex-1">
                {i.artwork?.slug ? <Link href={artPath(i.artwork.artist.slug, i.artwork.slug)} className="font-bold text-ink no-underline hover:text-scan">{i.title}</Link> : <b>{i.title}</b>}
                <div className="text-[13.5px] text-ink-2">
                  {i.artistName} · {SIZE[i.size || ""] || i.size} · ×{i.quantity || 1} · {i.order.createdAt.toLocaleDateString("en-US", { timeZone: STUDIO_TZ, month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <div className="grid justify-items-end gap-1">
                <b className="num">{usd(i.lineTotal || 0)}</b>
                <span className="rounded-full bg-wall px-2 py-0.5 text-[11.5px] font-bold capitalize text-ink-2">{i.order.shippingStatus}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </StudioPage>
  );
}
