import Link from "next/link";
import { EmptyState } from "@/components/studio/EmptyState";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import ScanChart from "@/components/codes/ScanChart";
import CodeEditor, { type CodeLook } from "@/components/codes/CodeEditor";
import { DEFAULT_DESIGN, FORMATS, sanitizeDesign } from "@/components/qr/card";
import { normalizeCode, shortLabel } from "@/lib/shortcode";
import { requireArtist, usd, timeAgo } from "../../_lib/data";
import { getCode, pct, status } from "../_lib";
import { partnerChoices, placeOptions } from "@/lib/artistPlaces";
import { formLabels, latestLabels } from "@/lib/labelStatus";
import LabelCard from "@/components/codes/LabelCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Code" };

const n = (v: number) => v.toLocaleString("en-US");
const DEVICE: Record<string, string> = { phone: "Phone", tablet: "Tablet", desktop: "Computer", unknown: "Unknown" };

function Bars({ rows, color, total }: { rows: { name: string; n: number }[]; color: string; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="grid gap-2.5">
      {rows.map((r) => (
        <li key={r.name} className="grid gap-1 text-[14px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">{r.name}</span>
            <span className="num shrink-0 text-ink-2">{n(r.n)} · {Math.round((r.n / Math.max(1, total)) * 100)}%</span>
          </div>
          <span className="block h-2 rounded-full bg-wall" aria-hidden="true">
            <span className="block h-2 rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: color }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function CodePage({ params }: { params: { code: string } }) {
  const artist = await requireArtist("/studio/codes");
  const code = normalizeCode(params.code);
  const c = code ? await getCode(artist.id, code) : null;
  if (!c) notFound();

  // Pieces in review count too: a code printed before approval must keep pointing at its piece when edited here.
  const arts = (await prisma.artwork.findMany({
    where: { artistId: artist.id, status: { in: ["APPROVED", "PENDING"] }, slug: { not: null } },
    select: { id: true, title: true, imageUrl: true, status: true, markupSmall: true },
    orderBy: { createdAt: "desc" },
  })).map(({ status: st, markupSmall, ...a }) => ({ ...a, smallMarkup: markupSmall || 0, title: st === "PENDING" ? `${a.title} (in review)` : a.title }));
  const [places, partners, labels] = await Promise.all([placeOptions(artist.id), partnerChoices(artist.id), latestLabels(artist.id, { qrCodeIds: [c.id] })]);
  const labelState = labels.get(c.id) ?? null;
  const label = labelState ? formLabels(labels)[0] : null;
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";
  const d = c.design ? sanitizeDesign(c.design) : { ...DEFAULT_DESIGN, disc: 0 };
  const look: CodeLook = {
    fg: d.fg, bg: d.bg, dots: d.dots, eyes: d.eyes, eye: d.eye === "same" ? null : d.eye, logo: d.logo,
    printedDisc: c.design ? d.disc : 0, printedVenue: c.design && d.evPrint && d.ev.trim() ? d.ev.trim() : null,
  };
  const st = status(c);
  const s = c.stats;
  const now = new Date();
  const scanTotal = c.cities.reduce((a, r) => a + r.n, 0);

  const tiles: [string, string, boolean?][] = [
    [n(s.scans), "scans"],
    [n(s.scans7), "last 7 days"],
    [n(s.visitors), "people"],
    [n(s.sales), s.sales === 1 ? "sale" : "sales"],
    [usd(s.shareCents), "you earned", true],
    [pct(s.sales, s.scans), "scans that bought"],
  ];

  return (
    <StudioPage
      title={c.label || c.artwork?.title || "Your page"}
      sub={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`inline-flex items-center gap-1.5 font-bold ${st.on ? "text-ink" : "text-ink-2"}`}>
            <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: st.on ? "#0f7a55" : "#b9bcc4" }} aria-hidden="true" />{st.text}
          </span>
          <a href={`/q/${c.code}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-scan">
            {shortLabel(c.code, base)}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <span>Made {c.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </span>
      }
      actions={<Link href="/studio/codes" className="btn btn-ghost btn-sm"><ArrowLeft className="h-4 w-4" aria-hidden="true" />My codes</Link>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:items-start">
        <div className="grid min-w-0 gap-4">
          {/* What the printed label says vs what scans show; first when it's out of date. */}
          {labelState && label && labelState.diffs.length > 0 && <LabelCard label={label} diffs={labelState.diffs} format={(FORMATS[labelState.format as keyof typeof FORMATS]?.name || "card").toLowerCase()} />}
          {s.scans === 0 ? (
            <EmptyState
              dab="var(--af-scan)"
              title="No scans yet"
              body={<>Hang this code and scans show up here within seconds: where, on what, and whether they bought. Scan it with your phone to test it.</>}
              action={c.artworkId ? { label: "Print this code", href: `/studio/qr?code=${c.code}` } : { label: "Download the code", href: "#dl-h" }}
              secondary={{ label: "Open its link", href: `/q/${c.code}` }}
              help={{ label: "Where to hang codes", href: "/help/getting-started/hanging-codes" }}
            />
          ) : (
          <>
          <section aria-label="Totals" className="af-card grid grid-cols-3 gap-x-3 gap-y-4 p-4 sm:grid-cols-6 sm:p-5">
            {tiles.map(([v, l, money]) => (
              <div key={l} className="grid min-w-0 gap-0.5">
                <b className={`num truncate text-[26px] font-bold leading-tight tracking-[-0.01em] ${money ? "text-earned" : ""}`}>{v}</b>
                <span className="t-small">{l}</span>
              </div>
            ))}
          </section>

          <section className="af-card grid gap-3 p-4 sm:p-5" aria-labelledby="chart-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="chart-h" className="t-card">Scans, by day</h2>
              <span className="t-small num">{n(c.days.reduce((a, d) => a + d.n, 0))} in 60 days</span>
            </div>
            <ScanChart days={c.days} />
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="where-h">
              <h2 id="where-h" className="t-card">Where</h2>
              {c.cities.length ? <Bars rows={c.cities.slice(0, 6)} color="var(--af-scan)" total={scanTotal} /> : <p className="t-small">No scans yet.</p>}
            </section>
            <section className="af-card grid content-start gap-3 p-4 sm:p-5" aria-labelledby="dev-h">
              <h2 id="dev-h" className="t-card">On what</h2>
              {c.devices.length ? <Bars rows={c.devices.map((r) => ({ ...r, name: DEVICE[r.name] || r.name }))} color="#7b2d8e" total={scanTotal} /> : <p className="t-small">No scans yet.</p>}
            </section>
          </div>

          <section className="af-card grid gap-3 p-4 sm:p-5" aria-labelledby="recent-h">
            <h2 id="recent-h" className="t-card">Latest scans</h2>
            {c.recent.length ? (
              <ul className="grid gap-2.5">
                {c.recent.map((r) => (
                  <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 text-[15px]">
                    <span className="truncate"><b>{r.place}</b> <span className="text-ink-2">· {DEVICE[r.device] || r.device}</span></span>
                    <span className="t-small">{timeAgo(new Date(r.at), now)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-small">Nobody has scanned it yet.</p>
            )}
          </section>
          </>
          )}
          {labelState && label && labelState.diffs.length === 0 && <LabelCard label={label} diffs={[]} format={(FORMATS[labelState.format as keyof typeof FORMATS]?.name || "card").toLowerCase()} />}
        </div>

        <CodeEditor
          initial={{
            code: c.code, label: c.label || "", discountPct: c.discountPct, active: c.active, expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null, artworkId: c.artworkId,
            // A code with venue text but no Place yet (older codes) shows it as a new Place to save.
            place: c.place ? { placeId: c.place.id, venueId: c.place.venueId, name: c.place.name } : { placeId: null, venueId: c.venueId, name: c.venue || "" },
          }}
          arts={arts}
          look={look}
          base={base}
          places={places}
          partners={c.venueId && !c.place ? [...partners, ...(partners.some((v) => v.id === c.venueId) ? [] : [{ id: c.venueId, name: c.venue || "Partner venue", neighborhood: null }])] : partners}
          label={label}
        />
      </div>
    </StudioPage>
  );
}
