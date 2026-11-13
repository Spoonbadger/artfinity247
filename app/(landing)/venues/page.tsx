import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { EmptyCanvas } from "@/components/browse/PageHead";
import { publicVenues } from "@/lib/venues";
import { UrlSort } from "@/components/browse/UrlSort";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Where to see the art",
  description: "Cafés, bars, shops and markets in New York with Artfinity art on the walls. Scan the code beside a piece to buy a print.",
  alternates: { canonical: "/venues" },
};

const SORTS = [
  { value: "hood", label: "By neighborhood" },
  { value: "az", label: "A to Z" },
  { value: "most", label: "Most art" },
];
const AROUND = "Around New York";

export default async function VenuesIndex({ searchParams }: { searchParams?: Record<string, string | undefined> }) {
  const venues = await publicVenues();
  const hood = (v: (typeof venues)[number]) => v.neighborhood?.trim() || AROUND;
  const sort = searchParams?.sort;
  // One grid; venues without a neighborhood go last in the default order.
  const ordered = [...venues].sort((a, b) =>
    sort === "az" ? a.name.localeCompare(b.name)
    : sort === "most" ? b.pieces - a.pieces || a.name.localeCompare(b.name)
    : (hood(a) === AROUND ? 1 : 0) - (hood(b) === AROUND ? 1 : 0) || hood(a).localeCompare(hood(b)) || a.name.localeCompare(b.name),
  );

  return (
    <div className="pb-20">
      <PageHead
        title="Where to see the art"
        sub={<>Local art in {venues.length} NYC {venues.length === 1 ? "spot" : "spots"}. Scan the code beside a piece to buy a print.</>}
        stroke="var(--af-coral)"
      />
      <div className="mx-auto grid max-w-[1240px] gap-4 px-4 sm:px-6">
        {ordered.length ? (
          <>
            {ordered.length > 3 && (
              <div className="flex justify-end">
                <UrlSort storageKey="venues" options={SORTS} fallback="hood" />
              </div>
            )}
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {ordered.map((v) => (
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
                        <span className="eyebrow">{hood(v)}</span>
                        <b className="t-card group-hover:text-scan">{v.name}</b>
                        {v.address && <span className="t-small">{v.address}</span>}
                        <span className="t-small">
                          {v.pieces ? `${v.pieces} ${v.pieces === 1 ? "piece" : "pieces"}` : "New art soon"}
                          {v.artists.length ? ` · ${v.artists.slice(0, 3).join(", ")}${v.artists.length > 3 ? ` and ${v.artists.length - 3} more` : ""}` : ""}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
          </>
        ) : (
          <EmptyCanvas title="Venues coming soon">
            <p className="t-muted">We&apos;re hanging art in cafés and shops around the city.</p>
          </EmptyCanvas>
        )}
      </div>
    </div>
  );
}
