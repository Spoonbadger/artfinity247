import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { EmptyCanvas } from "@/components/browse/PageHead";
import { publicVenues } from "@/lib/venues";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Where to see the art",
  description: "Cafés, bars, shops and markets around New York with Artfinity art on the walls. Every piece is for sale: scan the code beside it.",
  alternates: { canonical: "/venues" },
};

export default async function VenuesIndex() {
  const venues = await publicVenues();
  // Group by neighborhood; venues without one go last.
  const groups = new Map<string, typeof venues>();
  for (const v of venues) {
    const k = v.neighborhood?.trim() || "Around New York";
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  const ordered = Array.from(groups).sort(([a], [b]) => (a === "Around New York" ? 1 : b === "Around New York" ? -1 : a.localeCompare(b)));

  return (
    <div className="pb-20">
      <PageHead
        eyebrow="Partner venues"
        title="Where to see the art"
        sub={<>Local art in {venues.length} NYC {venues.length === 1 ? "spot" : "spots"}. Scan the code beside a piece to buy a print.</>}
        stroke="var(--af-coral)"
      />
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 sm:px-6">
        {ordered.length ? (
          ordered.map(([hood, list]) => (
            <section key={hood} aria-labelledby={`h-${hood.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="grid gap-4">
              <h2 id={`h-${hood.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="display text-[30px] sm:text-[36px]">{hood}</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((v) => (
                  <li key={v.id}>
                    <Link href={`/venues/${v.slug}`} className="af-card group grid h-full gap-3 p-4 text-ink no-underline transition hover:-translate-y-0.5">
                      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
                        {Array.from({ length: 4 }, (_, i) => v.thumbs[i]).map((t, i) =>
                          t ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={t.imageUrl} alt="" loading="lazy" className={`aspect-square w-full rounded-[3px] bg-wall object-cover ${t.sensitive.length ? "blur-md" : ""}`} />
                          ) : (
                            <span key={i} className="aspect-square w-full rounded-[3px] bg-wall" />
                          ),
                        )}
                      </div>
                      <div className="grid gap-0.5">
                        <b className="text-[18px] group-hover:text-scan">{v.name}</b>
                        {v.address && <span className="text-[13.5px] text-ink-2">{v.address}</span>}
                        <span className="text-[13.5px] text-ink-2">
                          {v.pieces ? `${v.pieces} ${v.pieces === 1 ? "piece" : "pieces"}` : "New art soon"}
                          {v.artists.length ? ` · ${v.artists.slice(0, 3).join(", ")}${v.artists.length > 3 ? ` and ${v.artists.length - 3} more` : ""}` : ""}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <EmptyCanvas title="Venues coming soon">
            <p className="text-ink-2">We&apos;re hanging art in cafés and shops around the city.</p>
          </EmptyCanvas>
        )}
      </div>
    </div>
  );
}
