"use client";
// /studio/places: every Place the artist's work hangs at, sortable, with paintings, codes, scans and sales for each.
import { useMemo } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/studio/EmptyState";
import { SortMenu, useSortPref, type SortOption } from "@/components/studio/SortMenu";
import { PLACE_KINDS, type PlaceKind } from "@/lib/placeRules";
import { cn } from "@/lib/utils";

export type PlaceCard = {
  id: string; name: string; kind: string; area: string | null; partner: string | null; createdAt: string;
  status: { text: string; on: boolean }; dates: string;
  paintings: number; codes: number; liveCodes: number; scans: number; scans30: number; sales: number; sales30: number;
};

type SortKey = "newest" | "name" | "scans" | "sales" | "paintings";
type ShowKey = "open" | "ended" | "all";
const SORTS: SortOption<SortKey>[] = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A–Z" },
  { value: "scans", label: "Most scans (30 days)" },
  { value: "sales", label: "Most sales (30 days)" },
  { value: "paintings", label: "Most paintings" },
];
const SORT_KEYS = SORTS.map((s) => s.value);
const SHOW_KEYS: ShowKey[] = ["open", "ended", "all"];
const n = (v: number) => v.toLocaleString("en-US");

function sortPlaces(list: PlaceCard[], sort: SortKey) {
  const out = [...list];
  const byNew = (a: PlaceCard, b: PlaceCard) => b.createdAt.localeCompare(a.createdAt);
  if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  else if (sort === "scans") out.sort((a, b) => b.scans30 - a.scans30 || b.scans - a.scans || byNew(a, b));
  else if (sort === "sales") out.sort((a, b) => b.sales30 - a.sales30 || b.sales - a.sales || byNew(a, b));
  else if (sort === "paintings") out.sort((a, b) => b.paintings - a.paintings || byNew(a, b));
  else out.sort(byNew);
  return out;
}

export default function PlacesBoard({ places }: { places: PlaceCard[] }) {
  const [sort, setSort] = useSortPref<SortKey>("studio-places", "newest", SORT_KEYS);
  const [show, setShow] = useSortPref<ShowKey>("studio-places-show", "open", SHOW_KEYS);
  const open = places.filter((p) => p.status.on).length;
  const ended = places.length - open;
  const showOptions: SortOption<ShowKey>[] = [
    { value: "open", label: `Open (${open})` },
    { value: "ended", label: `Closed or ended (${ended})` },
    { value: "all", label: `All (${places.length})` },
  ];
  const visible = useMemo(() => sortPlaces(show === "all" ? places : places.filter((p) => (show === "open") === p.status.on), sort), [places, show, sort]);

  if (!places.length) {
    return (
      <EmptyState
        dab="#7b2d8e"
        title="No places yet"
        body="Add the café, gallery or market where your work hangs. Then hang paintings and codes there, and close it in one go when the show ends."
        help={{ label: "How places work", href: "/help/qr-codes/places" }}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SortMenu label="Sort" value={sort} onChange={setSort} options={SORTS} />
        {ended > 0 && <SortMenu label="Show" kind="filter" value={show} onChange={setShow} options={showOptions} />}
      </div>
      {visible.length === 0 ? (
        <EmptyState compact dab="#7b2d8e" title="Nothing here" body={show === "open" ? "Every place is closed or ended." : "No places match this filter."} action={{ label: "Show all", onClick: () => setShow("all") }} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <li key={p.id} className="h-full">
              <Link href={`/studio/places/${p.id}`} className="box grid h-full content-start gap-3 p-4 text-ink no-underline transition-colors hover:border-ink">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid min-w-0 gap-0.5">
                    <b className="t-card truncate">{p.name}</b>
                    <span className="t-small truncate">
                      {[PLACE_KINDS[p.kind as PlaceKind] ?? "Place", p.area, p.dates].filter(Boolean).join(" · ")}
                    </span>
                    {p.partner && <span className="t-small inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />Artfinity partner venue</span>}
                  </div>
                  <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold", p.status.on ? "text-ink" : "text-ink-2")}>
                    <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: p.status.on ? "#0f7a55" : "#b9bcc4" }} aria-hidden="true" />{p.status.text}
                  </span>
                </div>
                <dl className="grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
                  {([
                    ["paintings", n(p.paintings), null],
                    ["codes", n(p.codes), p.liveCodes !== p.codes ? `${n(p.liveCodes)} on` : null],
                    ["scans", n(p.scans30), `${n(p.scans)} all time`],
                    ["sales", n(p.sales30), `${n(p.sales)} all time`],
                  ] as const).map(([l, v, note]) => (
                    <div key={l} className="grid gap-0.5">
                      <dd className="num text-[18px] font-bold">{v}</dd>
                      <dt className="text-[13px] text-ink-2">{l}{l === "scans" || l === "sales" ? <span className="sr-only"> in 30 days</span> : null}</dt>
                      {note && <dd className="num text-[12px] text-ink-2">{note}</dd>}
                    </div>
                  ))}
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="t-small">Scans and sales: last 30 days.</p>
    </div>
  );
}
