"use client";

import { useMemo, useState } from "react";
import type { LedgerLine } from "@/lib/balance";
import BarChart, { Legend, type Bucket, type Series } from "./BarChart";
import { PERIODS, SIZE_INCH, SIZE_LABEL, STATUS_COLOR, bucketOf, inPeriod, monthName, usd, weekStart, type Period } from "./format";

const DAY = 86_400_000;
const STATUS_SERIES: Series[] = [
  { name: "Paid out", color: STATUS_COLOR.paid },
  { name: "Ready for payout", color: STATUS_COLOR.available },
  { name: "On hold", color: STATUS_COLOR.pending, hatch: true },
];
const GROSS_SERIES: Series[] = [
  { name: "Gross sales", color: "#c8763a" },
  { name: "Your share", color: "#0f7a55" },
];
const short = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });

function Stat({ label, value, note, dab, money = false }: { label: string; value: string; note?: string; dab: string; money?: boolean }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5 rounded-[3px] border border-line bg-white p-3 shadow-[0_2px_0_var(--af-line)]">
      <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2"><i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: dab }} />{label}</span>
      <b className={`display num truncate text-[24px] leading-tight sm:text-[27px] ${money ? "text-earned" : "text-ink"}`} title={value}>{value}</b>
      {note && <span className="truncate text-[12px] text-ink-2" title={note}>{note}</span>}
    </div>
  );
}

function topBy<T extends string>(lines: LedgerLine[], key: (l: LedgerLine) => T | "", val: (l: LedgerLine) => number) {
  const m = new Map<T, number>();
  for (const l of lines) { const k = key(l); if (k) m.set(k, (m.get(k) || 0) + val(l)); }
  let best: [T, number] | null = null;
  m.forEach((v, k) => { if (!best || v > best[1]) best = [k, v]; });
  return best as [T, number] | null;
}

export default function MoneyInsights({ ledger, nowIso }: { ledger: LedgerLine[]; nowIso: string }) {
  const [period, setPeriod] = useState<Period>("90d");
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const lines = useMemo(() => inPeriod(ledger, period, now), [ledger, period, now]);

  const stats = useMemo(() => {
    const prints = lines.reduce((n, l) => n + l.quantity, 0);
    const gross = lines.reduce((n, l) => n + l.grossCents, 0);
    const share = lines.reduce((n, l) => n + l.shareCents, 0);
    const piece = topBy(lines, (l) => l.title, (l) => l.shareCents);
    const piecePrints = piece ? lines.filter((l) => l.title === piece[0]).reduce((n, l) => n + l.quantity, 0) : 0;
    const size = topBy(lines, (l) => l.size, (l) => l.quantity);
    const city = topBy(lines, (l) => l.buyerCity, (l) => l.quantity);
    const orders = new Map<string, Set<string>>();
    for (const l of lines) { const s = orders.get(l.buyerKey) || new Set(); s.add(l.orderId); orders.set(l.buyerKey, s); }
    const repeat = Array.from(orders.values()).filter((s) => s.size >= 2).length;
    return { prints, gross, share, piece, piecePrints, size, city, buyers: orders.size, repeat };
  }, [lines]);

  // Last 12 weeks, stacked by status (fixed window).
  const weeks: Bucket[] = useMemo(() => {
    const first = new Date(weekStart(now).getTime() - 11 * 7 * DAY);
    const out: Bucket[] = Array.from({ length: 12 }, (_, i) => {
      const s = new Date(first.getTime() + i * 7 * DAY);
      return { key: s.toISOString(), label: short(s), sub: `Week of ${short(s)}`, values: [0, 0, 0] };
    });
    for (const l of ledger) {
      const i = Math.floor((new Date(l.date).getTime() - first.getTime()) / (7 * DAY));
      if (i < 0 || i > 11) continue;
      const bucket = bucketOf(l, now.toISOString().slice(0, 7));
      out[i].values[bucket === "paid" ? 0 : bucket === "ready" ? 1 : 2] += l.shareCents;
    }
    return out;
  }, [ledger, now]);

  // Gross vs your share for the chosen period: weekly for 30/90 days, monthly otherwise.
  const grossBuckets: Bucket[] = useMemo(() => {
    if (period === "30d" || period === "90d") {
      const n = period === "30d" ? 5 : 13;
      const first = new Date(weekStart(now).getTime() - (n - 1) * 7 * DAY);
      const out: Bucket[] = Array.from({ length: n }, (_, i) => {
        const s = new Date(first.getTime() + i * 7 * DAY);
        return { key: s.toISOString(), label: short(s), sub: `Week of ${short(s)}`, values: [0, 0] };
      });
      for (const l of lines) {
        const i = Math.floor((new Date(l.date).getTime() - first.getTime()) / (7 * DAY));
        if (i >= 0 && i < n) { out[i].values[0] += l.grossCents; out[i].values[1] += l.shareCents; }
      }
      return out;
    }
    const end = now.toISOString().slice(0, 7);
    let start = end;
    if (period === "12m") {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)).toISOString().slice(0, 7);
    } else {
      for (const l of ledger) if (l.payoutMonth < start) start = l.payoutMonth;
    }
    const out: Bucket[] = [];
    const [sy, sm] = start.split("-").map(Number);
    for (let i = 0; ; i++) {
      const k = new Date(Date.UTC(sy, sm - 1 + i, 1)).toISOString().slice(0, 7);
      if (k > end) break;
      out.push({ key: k, label: monthName(k).split(" ")[0], sub: monthName(k, "long"), values: [0, 0] });
    }
    const idx = new Map(out.map((b, i) => [b.key, i]));
    for (const l of lines) {
      const i = idx.get(l.payoutMonth);
      if (i !== undefined) { out[i].values[0] += l.grossCents; out[i].values[1] += l.shareCents; }
    }
    return out;
  }, [lines, ledger, period, now]);

  const periodLabel = PERIODS.find((p) => p.id === period)!.label;
  const weeksTotal = weeks.reduce((n, w) => n + w.values.reduce((a, b) => a + b, 0), 0);

  return (
    <section aria-labelledby="insights-h" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="insights-h" className="display text-[30px] sm:text-[34px]">Earnings</h2>
        <div role="radiogroup" aria-label="Period" className="flex rounded-full border-2 border-ink bg-white p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id} type="button" role="radio" aria-checked={period === p.id} onClick={() => setPeriod(p.id)}
              className={`min-h-[36px] rounded-full px-3 text-[13.5px] font-semibold sm:px-3.5 ${period === p.id ? "bg-ink text-white" : "text-ink hover:bg-wall"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat dab="#e8743b" label="Prints sold" value={stats.prints.toLocaleString("en-US")} note={periodLabel} />
        <Stat dab="#c8763a" label="Gross sales" value={usd(stats.gross)} note="What buyers paid" />
        <Stat dab="#0f7a55" label="Your share" value={usd(stats.share)} note={stats.gross ? `${Math.round((stats.share / stats.gross) * 100)}% of gross` : "Of profit"} money />
        <Stat dab="#3d9f76" label="Avg per print" value={usd(stats.prints ? Math.round(stats.share / stats.prints) : 0)} note="Your share" money />
        <Stat dab="#ffd43b" label="Best piece" value={stats.piece ? stats.piece[0] : "None yet"} note={stats.piece ? `${usd(stats.piece[1])} · ${stats.piecePrints} sold` : periodLabel} />
        <Stat dab="#2b37f0" label="Best size" value={stats.size ? SIZE_LABEL[stats.size[0]] : "None yet"} note={stats.size ? `${SIZE_INCH[stats.size[0]]} in · ${stats.size[1]} sold` : periodLabel} />
        <Stat dab="#ff5a36" label="Top city" value={stats.city ? stats.city[0] : "None yet"} note={stats.city ? `${stats.city[1]} ${stats.city[1] === 1 ? "print" : "prints"}` : periodLabel} />
        <Stat dab="#7b2d8e" label="Repeat buyers" value={String(stats.repeat)} note={`of ${stats.buyers} ${stats.buyers === 1 ? "buyer" : "buyers"}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="af-card grid min-w-0 content-start gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[18px] font-bold">Your share by week</h3>
            <span className="num text-[12.5px] text-ink-2">{usd(weeksTotal)} · last 12 weeks</span>
          </div>
          <Legend series={STATUS_SERIES} />
          <BarChart buckets={weeks} series={STATUS_SERIES} label={`Your share per week, last 12 weeks, stacked by payout status. ${usd(weeksTotal)} in all.`} />
        </div>
        <div className="af-card grid min-w-0 content-start gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[18px] font-bold">Gross vs your share</h3>
            <span className="num text-[12.5px] text-ink-2">{period === "30d" || period === "90d" ? "By week" : "By month"} · {periodLabel}</span>
          </div>
          <Legend series={GROSS_SERIES} />
          <BarChart buckets={grossBuckets} series={GROSS_SERIES} mode="overlay" label={`Gross sales and your share, ${periodLabel}. Gross ${usd(stats.gross)}, your share ${usd(stats.share)}.`} />
        </div>
      </div>

      <Sources lines={lines} periodLabel={periodLabel} />
    </section>
  );
}

/** Your share by source (the printed code a sale came through). Placeholder until any sale carries one. */
function Sources({ lines, periodLabel }: { lines: LedgerLine[]; periodLabel: string }) {
  const tracked = lines.filter((l) => l.source);
  if (!tracked.length) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[4px] border-2 border-dashed border-line bg-wall/60 px-4 py-3 text-[13.5px]">
        <b>Where sales come from</b>
        <span className="text-ink-2">Source tracking arrives with short links.</span>
      </div>
    );
  }
  const by = new Map<string, { share: number; prints: number }>();
  for (const l of lines) {
    const k = l.source || "Direct and links";
    const v = by.get(k) || { share: 0, prints: 0 };
    v.share += l.shareCents; v.prints += l.quantity;
    by.set(k, v);
  }
  const rows = Array.from(by.entries()).sort((a, b) => b[1].share - a[1].share).slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r[1].share));
  return (
    <section aria-labelledby="sources-h" className="af-card grid gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="sources-h" className="text-[18px] font-bold">Where sales come from</h3>
        <span className="text-[12.5px] text-ink-2">Your share · {periodLabel}</span>
      </div>
      <ul className="grid gap-2.5">
        {rows.map(([name, v]) => (
          <li key={name} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="min-w-0 truncate font-semibold">{name}</span>
              <span className="num shrink-0"><b className="text-earned">{usd(v.share)}</b> <span className="text-[12.5px] text-ink-2">· {v.prints} {v.prints === 1 ? "print" : "prints"}</span></span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-wall" aria-hidden="true">
              <div className="h-full rounded-full bg-earned" style={{ width: `${Math.max(3, (v.share / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
