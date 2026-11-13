import Link from "next/link";
import { Plus } from "lucide-react";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import HelpLink from "@/components/help/HelpLink";
import { requireArtist, usd } from "../_lib/data";
import QueueLink from "@/components/qr/QueueLink";
import { queueCount } from "@/lib/printQueue";
import { getCodes, pct, status, windowTotals, WINDOW_DAYS, type CodeRow } from "./_lib";
import CodesList, { type CodeListRow } from "@/components/codes/CodesList";
import { partnerChoices, placeOptions } from "@/lib/artistPlaces";
import { latestLabels } from "@/lib/labelStatus";
import { priceWords } from "@/lib/labelFacts";

export const dynamic = "force-dynamic";
export const metadata = { title: "My codes" };

const DAY = 86400000;
const n = (v: number) => v.toLocaleString("en-US");
const date = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** One headline number, the same tile as the Studio home. Paint stays in the codes themselves. */
function Stat({ label, value, note, earned }: { label: string; value: string; note: string; earned?: boolean }) {
  return (
    <div className="box grid min-w-0 content-start gap-1 p-4">
      <span className="t-small font-semibold">{label}</span>
      <b className={`num text-[26px] font-bold leading-tight tracking-[-0.01em] sm:text-[28px] ${earned ? "text-earned" : "text-ink"}`}>{value}</b>
      <span className="t-small truncate">{note}</span>
    </div>
  );
}

/** "Printed Nov 5" (or "Mailed Nov 5" for codes we printed), from the print queue's log. */
function printedText(c: CodeRow) {
  const p = c.printLogs?.[0];
  if (!p) return null;
  const d = p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  return p.method === "mail" ? `Printed by us, shipped ${d}` : `Printed ${d}`;
}

export default async function CodesPage({ searchParams }: { searchParams: { show?: string } }) {
  const artist = await requireArtist("/studio/codes");
  const now = new Date();
  const codes = await getCodes(artist.id);
  const [places, partners, labels] = await Promise.all([placeOptions(artist.id), partnerChoices(artist.id), latestLabels(artist.id)]);
  const rows: CodeListRow[] = codes.map((c) => {
    const l = labels.get(c.id);
    return {
      id: c.id, code: c.code, title: c.label || c.artwork?.title || "Your page", imageUrl: c.artwork?.imageUrl ?? null, artTitle: c.artwork?.title ?? null,
      createdAt: c.createdAt.toISOString(), made: date(c.createdAt), place: c.place ? { id: c.place.id, name: c.place.name } : null, venue: c.venue, discountPct: c.discountPct,
      status: status(c), printed: printedText(c), stale: l && l.diffs.length ? priceWords(l) : null, stats: c.stats,
    };
  });
  const stale = rows.filter((r) => r.stale).length;
  // Every headline tile uses the same window; the table below is all-time per code.
  const win = await windowTotals(codes.map((c) => c.id), new Date(now.getTime() - WINDOW_DAYS * DAY));
  const allScans = codes.reduce((n, c) => n + c.stats.scans, 0);

  return (
    <StudioPage
      title="My codes"
      sub={codes.length ? "Every printed code. Edit any of them, even after printing." : undefined}
      actions={<><HelpLink href="/help/qr-codes/change-after-printing" /><QueueLink count={await queueCount(artist.id)} /><Link href="/studio/qr" className="btn btn-blue btn-sm"><Plus className="h-4 w-4" aria-hidden="true" />Make a code</Link></>}
    >
      {codes.length === 0 ? (
        <EmptyState
          dab="var(--af-scan)"
          title="No codes yet"
          body="Make a code, print it and hang it beside your work. Each one shows its scans, sales and earnings here, and you can change where it points after printing."
          action={{ label: "Make a code", href: "/studio/qr" }}
          help={{ label: "Where to hang codes", href: "/help/getting-started/hanging-codes" }}
        />
      ) : (
        <>
          <section aria-labelledby="totals-h" className="grid gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="totals-h" className="eyebrow">Last {WINDOW_DAYS} days</h2>
              <span className="t-small num font-semibold">{n(allScans)} scans all time</span>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <Stat label="Scans" value={n(win.scans)} note="Every scan counted" />
              <Stat label="People" value={n(win.people)} note="Different phones" />
              <Stat label="Sales from codes" value={n(win.sales)} note={`${pct(win.sales, win.scans)} of scans`} />
              <Stat label="You earned" value={usd(win.shareCents)} note="From code sales" earned />
            </div>
          </section>

          {stale > 0 && searchParams.show !== "stale" && (
            <Problem title={`${stale} printed ${stale === 1 ? "label shows" : "labels show"} an old price`} fix={{ label: "Show them", href: "/studio/codes?show=stale" }}>
              Scans show today&apos;s price. Reprint, or mark the old labels replaced.
            </Problem>
          )}
          <CodesList rows={rows} places={places} partners={partners} initialShow={searchParams.show ?? null} />
        </>
      )}
    </StudioPage>
  );
}
