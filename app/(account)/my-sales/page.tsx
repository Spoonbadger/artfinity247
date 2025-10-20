"use client";
import { useEffect, useState } from "react";

type SaleRow = any; // tighten once we lock the API shape

export default function MySalesPage() {
  const [rows, setRows] = useState<SaleRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/my-sales", { credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setRows(data?.items || data || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load sales");
      }
    })();
  }, []);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!rows) return <div className="p-6">Loading…</div>;
  if (!rows.length) return <div className="p-6">No sales yet.</div>;

  const fmt = (cents: number) => (cents ?? 0) / 100;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sales</h1>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="text-left border-b">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Artwork</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Buyer</th>
              <th className="py-2 pr-4">Total ($)</th>
              <th className="py-2 pr-4">Your Share ($)</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</td>
                <td className="py-2 pr-4">{r.title || r.artworkTitle || "-"}</td>
                <td className="py-2 pr-4">{r.quantity ?? 1}</td>
                <td className="py-2 pr-4">{r.buyerEmail || r.buyer || "-"}</td>
                <td className="py-2 pr-4">{fmt(r.total_cents).toFixed(2)}</td>
                <td className="py-2 pr-4">{fmt(r.artist_share_cents).toFixed(2)}</td>
                <td className="py-2">{r.payoutStatus || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
