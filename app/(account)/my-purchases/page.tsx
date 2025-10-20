"use client";
import { useEffect, useState } from "react";

type PurchaseRow = any;

export default function MyPurchasesPage() {
  const [rows, setRows] = useState<PurchaseRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/my-purchases", { credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setRows(data?.items || data || []);
      } catch (e: any) {
        setErr(e?.message || "Failed to load purchases");
      }
    })();
  }, []);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!rows) return <div className="p-6">Loading…</div>;
  if (!rows.length) return <div className="p-6">No purchases yet.</div>;

  const fmt = (cents: number) => (cents ?? 0) / 100;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Your Purchases</h1>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead className="text-left border-b">
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Artwork</th>
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Artist</th>
              <th className="py-2 pr-4">Total Paid ($)</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-"}</td>
                <td className="py-2 pr-4">{r.title || r.artworkTitle || "-"}</td>
                <td className="py-2 pr-4">{r.quantity ?? 1}</td>
                <td className="py-2 pr-4">{r.artistName || "-"}</td>
                <td className="py-2 pr-4">{fmt(r.total_cents).toFixed(2)}</td>
                <td className="py-2">{r.status || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}