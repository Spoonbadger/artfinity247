// app/(account)/my-sales/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type SaleRow = {
  id: string;
  createdAt: string | null;
  artworkTitle: string;
  quantity: number;
  buyerEmail: string | null;
  total_cents: number;
  artist_share_cents: number;
  currency: string;
  expenses_cents: number
};

type ApiResponse = {
  items: SaleRow[];
  totals: {
    items: number;
    quantity: number;
    gross_cents: number;
    artist_share_cents: number;
    expenses_cents: number
  };
  month: string; // "all" or "YYYY-MM"
};

function monthOptions() {
  const opts = ["all"];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    opts.push(`${y}-${m}`);
    d.setMonth(d.getMonth() - 1);
  }
  return opts;
}

export default function MySalesPage() {
  const [rows, setRows] = useState<SaleRow[] | null>(null);
  const [totals, setTotals] = useState<ApiResponse["totals"] | null>(null);
  const [month, setMonth] = useState<string>("all");
  const [err, setErr] = useState<string | null>(null);
  const months = useMemo(() => monthOptions(), []);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setRows(null);
        const qs = month === "all" ? "" : `?month=${month}`;
        const res = await fetch(`/api/my-sales${qs}`, { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data: ApiResponse = await res.json();
        setRows(data.items || []);
        setTotals(data.totals || null);
      } catch (e: any) {
        setErr(e?.message || "Failed to load sales");
      }
    })();
  }, [month]);

  const fmtUsd = (cents = 0) => (cents / 100).toFixed(2);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!rows) return <div className="p-6">Loading…</div>;
  if (!rows.length)
    return (
      <div className="p-6">
        <div className="mb-3 flex items-center gap-2">
          <label className="text-sm font-medium">Month:</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-2 py-1"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        No sales yet.
      </div>
    );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Month:</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-2 py-1"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {totals && (
        <div className="rounded border p-3 text-sm bg-white/50">
          <span className="mr-4">
            Orders: <strong>{totals.items}</strong>
          </span>
          <span className="mr-4">
            Qty: <strong>{totals.quantity}</strong>
          </span>
          <span className="mr-4">
            Gross: <strong>${fmtUsd(totals.gross_cents)}</strong>
          </span>
          <span className="mr-4">
            Expenses: <strong>${fmtUsd(totals.expenses_cents)}</strong>
          </span>
          <span>
            Your share: <strong>${fmtUsd(totals.artist_share_cents)}</strong>
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="text-left border-b">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Artwork</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Buyer</th>
              <th className="py-2 pr-4">Total ($)</th>
              <th className="py-2 pr-4">Expenses ($)</th>
              <th className="py-2 pr-4">Your Share ($)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}
                </td>
                <td className="py-2 pr-4">{r.artworkTitle || "-"}</td>
                <td className="py-2 pr-4">{r.quantity ?? 1}</td>
                <td className="py-2 pr-4">{r.buyerEmail || "-"}</td>
                <td className="py-2 pr-4">${fmtUsd(r.total_cents)}</td>
                <td className="py-2 pr-4">${fmtUsd(r.expenses_cents)}</td>
                <td className="py-2 pr-4">${fmtUsd(r.artist_share_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}