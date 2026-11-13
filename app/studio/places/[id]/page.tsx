import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StudioPage } from "@/components/studio/StudioPage";
import PlaceManager, { PrintPlaceButton, type PlaceCode } from "@/components/places/PlaceManager";
import { currentHangings, partnerChoices, placeDetail, placeOptions } from "@/lib/artistPlaces";
import { PLACE_KINDS, dayLabel, placeDates, placeEnded, placeStatus, scanRoute, type PlaceKind } from "@/lib/placeRules";
import { prisma } from "@/lib/prisma";
import { requireArtist, usd } from "../../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Place" };

const n = (v: number) => v.toLocaleString("en-US");
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export default async function PlacePage({ params }: { params: { id: string } }) {
  const artist = await requireArtist(`/studio/places/${params.id}`);
  const d = await placeDetail(artist.id, params.id);
  if (!d) notFound();
  const { place: p, stats: s } = d;
  const now = new Date();
  const [others, partners, venues, arts, hanging] = await Promise.all([
    placeOptions(artist.id),
    partnerChoices(artist.id),
    prisma.venue.findMany({ where: { OR: [{ active: true }, ...(p.venueId ? [{ id: p.venueId }] : [])] }, select: { id: true, name: true, neighborhood: true }, orderBy: { name: "asc" } }),
    prisma.artwork.findMany({ where: { artistId: artist.id, status: { in: ["APPROVED", "PENDING"] } }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    currentHangings(artist.id),
  ]);
  const st = placeStatus(p, now);
  const ended = placeEnded(p, now);
  const here = new Set(d.paintings.map((x) => x.id));
  const route = scanRoute(p, now);
  const codeStatus = (c: { live: boolean; active: boolean }) => !c.live ? (c.active ? "Ended" : "Paused") : route === "pause" ? "Paused (place closed)" : route === "page" ? "Opens your page" : "Active";
  const codes: PlaceCode[] = d.codes.map((c) => ({ code: c.code, title: c.label || c.artwork?.title || "Your page", imageUrl: c.artwork?.imageUrl ?? null, live: c.live, scans: c.scans, discountPct: c.discountPct, status: codeStatus(c) }));

  const tiles: [string, string, string][] = [
    [n(s.paintings), s.paintings === 1 ? "painting here" : "paintings here", ""],
    [n(s.codes), s.codes === 1 ? "code" : "codes", s.liveCodes !== s.codes ? `${n(s.liveCodes)} on` : ""],
    [n(s.scans30), "scans, 30 days", `${n(s.scans)} all time`],
    [n(s.sales30), "sales, 30 days", `${n(s.sales)} all time · ${usd(s.revenueCents)}`],
  ];

  return (
    <StudioPage
      title={p.name}
      sub={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`inline-flex items-center gap-1.5 font-bold ${st.on ? "text-ink" : "text-ink-2"}`}>
            <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: st.on ? "#0f7a55" : "#b9bcc4" }} aria-hidden="true" />{st.text}
          </span>
          <span>{[PLACE_KINDS[p.kind as PlaceKind] ?? "Place", p.area, placeDates(p)].filter(Boolean).join(" · ")}</span>
          {p.venue && (p.venue.active ? <Link href={`/venues/${p.venue.slug}`} className="font-semibold text-scan">Partner venue</Link> : <span>Partner venue</span>)}
        </span>
      }
      actions={<><Link href="/studio/places" className="btn btn-ghost btn-sm"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Places</Link><PrintPlaceButton placeId={p.id} disabled={!codes.length && !d.paintings.length} /></>}
    >
      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {tiles.map(([v, l, note]) => (
          <div key={l} className="box grid min-w-0 content-start gap-1 p-4">
            <span className="t-small font-semibold">{l}</span>
            <b className="num text-[26px] font-bold leading-tight tracking-[-0.01em]">{v}</b>
            {note && <span className="t-small truncate">{note}</span>}
          </div>
        ))}
      </section>

      <PlaceManager
        place={{
          id: p.id, name: p.name, kind: p.kind, area: p.area, venueId: p.venueId, startsOn: p.startsOn, endsOn: p.endsOn, active: p.active, afterEnd: p.afterEnd,
          ended, endedByDate: p.active && ended, closedOn: !p.active && p.closedAt ? day(p.closedAt) : p.active && ended && p.endsOn ? dayLabel(p.endsOn) : null,
        }}
        paintings={d.paintings.map((x) => ({ id: x.id, title: x.title, slug: x.slug, imageUrl: x.imageUrl, since: day(x.since) }))}
        codes={codes}
        choices={arts.filter((a) => !here.has(a.id)).map((a) => ({ id: a.id, title: a.title, at: hanging.get(a.id)?.name ?? null }))}
        others={others.filter((o) => o.id !== p.id)}
        partners={partners}
        venues={venues}
      />

      {(d.events.length > 0 || d.history.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {d.events.length > 0 && (
            <section aria-labelledby="events-h" className="box grid content-start gap-2 p-4 sm:p-5">
              <h2 id="events-h" className="t-card">Events here</h2>
              <ul className="grid gap-1.5 text-[15px]">
                {d.events.map((e) => <li key={e.id}><b>{e.name}</b> <span className="t-small">· {placeDates({ startsOn: e.start, endsOn: e.end })}</span></li>)}
              </ul>
              <Link href="/studio/events" className="text-[14px] font-bold text-scan">Events</Link>
            </section>
          )}
          {d.history.length > 0 && (
            <section aria-labelledby="hist-h" className="box grid content-start gap-2 p-4 sm:p-5">
              <h2 id="hist-h" className="t-card">Hung here before</h2>
              <ul className="grid gap-1.5 text-[15px]">
                {d.history.map((h) => <li key={h.id}><b>{h.artwork.title}</b> <span className="t-small">· {day(h.startedAt)} – {h.endedAt ? day(h.endedAt) : ""}</span></li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </StudioPage>
  );
}
