"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  title: string;
  quantity: number;
  artistName: string | null;
  lineTotal: number; // cents
  createdAt: string | null; // ISO
  paymentStatus: string | null;
};

export default function MyPurchasesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/my-purchases", { credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        // API returns array of orderItems with nested order
        const arr = Array.isArray(data) ? data : data?.items || [];
        const normalized: Row[] = arr.map((r: any) => ({
          id: r.id,
          title: r.title ?? r.artworkTitle ?? "-",
          quantity: r.quantity ?? 1,
          artistName: r.artistName ?? null,
          lineTotal:
            typeof r.lineTotal === "number"
              ? r.lineTotal
              : (r.unitPrice ?? 0) * (r.quantity ?? 1),
          createdAt: r.order?.createdAt ?? null,
          paymentStatus: r.order?.paymentStatus ?? null,
        }));
        setRows(normalized);
      } catch (e: any) {
        setErr(e?.message || "Failed to load purchases");
      }
    })();
  }, []);

  if (err) return <div className="p-6 text-red-600">{err}</div>;
  if (!rows) return <div className="p-6 text-theme-secondary-600">Loading…</div>;
  if (!rows.length) return <div className="p-6">No purchases yet.</div>;

  const fmt = (cents: number) => ((cents ?? 0) / 100).toFixed(2);

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
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="py-2 pr-4">{r.title}</td>
                <td className="py-2 pr-4">{r.quantity}</td>
                <td className="py-2 pr-4">{r.artistName ?? "—"}</td>
                <td className="py-2 pr-4">{fmt(r.lineTotal)}</td>
                <td className="py-2">{r.paymentStatus ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}