"use client";

// "Export CSV" for Sales, Money and Analytics. Fetches first, so an empty export explains itself (the routes answer
// 404 { error, code: "no_sales" | "no_views" } with nothing to export) instead of handing over a file with only a header.
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export default function ExportCsvButton({ href, label = "Export CSV", className }: { href: string; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(href, { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't make the CSV. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : run });
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "artfinity.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      saved("CSV downloaded", { description: `${name} is in your downloads. It opens in Excel, Numbers or Google Sheets.` });
    } catch {
      failed("You seem to be offline", { description: "Check your connection and try again.", retry: run });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={run} disabled={busy} className={cn("btn btn-ghost", className)}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );
}
