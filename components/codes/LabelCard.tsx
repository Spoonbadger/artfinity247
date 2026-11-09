"use client";
// Code detail: what the printed label says vs what scans show now, with [Reprint] and [Mark old labels as replaced].
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Printer } from "lucide-react";
import { errorText, failed, problemFrom, saved, withUndo } from "@/lib/feedback";
import { priceWords, type LabelDiff, type PrintedLabel } from "@/lib/labelFacts";
import { queueReprint } from "./LabelWarning";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export default function LabelCard({ label, diffs, format }: { label: PrintedLabel; diffs: LabelDiff[]; format: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "reprint" | "replaced">("");
  const stale = diffs.length > 0;

  async function reprint() {
    setBusy("reprint");
    try {
      const q = await queueReprint([label.code]);
      saved("Added to your print queue", { description: `Same look, today's price. ${q.cards} ${q.cards === 1 ? "card" : "cards"} waiting.`, next: { label: "Open print queue", href: "/studio/qr/queue" } });
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't add it to your print queue. Try again."), { retry: reprint });
    } finally { setBusy(""); }
  }

  async function replaced() {
    setBusy("replaced");
    try {
      const r = await fetch("/api/studio/code-prints/replaced", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codes: [label.code] }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't mark them. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : replaced });
        return;
      }
      const { ids } = await r.json();
      router.refresh();
      withUndo("Old labels marked as replaced", async () => {
        await fetch("/api/studio/code-prints/replaced", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ undo: ids }) });
        router.refresh();
      }, { description: "This code stops showing as out of date." });
    } catch (e) {
      failed(errorText(e, "Couldn't mark them. Try again."), { retry: replaced });
    } finally { setBusy(""); }
  }

  const rows: [string, string, string, boolean][] = [
    ["Price", priceWords({ priceCents: label.priceCents, discountPct: 0 }).replace("Prints from ", "From "), priceWords({ priceCents: label.now.priceCents, discountPct: 0 }).replace("Prints from ", "From "), diffs.includes("price")],
    ["Discount", label.discountPct ? `${label.discountPct}% off` : "None", label.now.discountPct ? `${label.now.discountPct}% off` : "None", diffs.includes("discount")],
    ...(label.showsTitle ? [["Title", label.title, label.now.title, diffs.includes("title")] as [string, string, string, boolean]] : []),
  ];

  return (
    <section aria-labelledby="label-h" className={`grid gap-3 rounded-2xl border p-4 sm:p-5 ${stale ? "border-sticker bg-sticker/15" : "border-edge bg-white"}`}>
      <div className="grid gap-0.5">
        <h2 id="label-h" className="t-card">{stale ? "Label out of date" : "Printed label"}</h2>
        <p className="t-small">Printed {day(label.printedAt)} · {label.qty} {format}{label.qty === 1 ? "" : "s"}</p>
      </div>
      <table className="w-full text-left text-[14px]">
        <caption className="sr-only">What the printed label says and what scans show now</caption>
        <thead className="text-[13px] text-ink-2">
          <tr><th scope="col" className="py-1 font-semibold"><span className="sr-only">Detail</span></th><th scope="col" className="py-1 font-semibold">Label says</th><th scope="col" className="py-1 font-semibold">Scans show</th></tr>
        </thead>
        <tbody>
          {rows.map(([k, was, now, diff]) => (
            <tr key={k} className="border-t border-line">
              <th scope="row" className="py-1.5 pr-2 font-semibold">{k}</th>
              <td className="num py-1.5 pr-2">{was}</td>
              <td className={`num py-1.5 ${diff ? "font-bold" : ""}`}>{now}{diff && <span className="sr-only"> (different)</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stale ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm" onClick={reprint} disabled={!!busy}>
            {busy === "reprint" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="h-4 w-4" aria-hidden="true" />}Reprint
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={replaced} disabled={!!busy} title="After reprinting, or once the old labels are off the wall">
            {busy === "replaced" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}Mark old labels as replaced
          </button>
        </div>
      ) : (
        <p className="t-small">Matches what scans show.</p>
      )}
    </section>
  );
}
