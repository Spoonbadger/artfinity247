"use client";
// /studio/qr/queue: the codes lined up to print, grouped by format, with the two ways to print them:
// at home (one mixed PDF per format, on the label sheets named here) or mailed by us, laminated and cut, at cost.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, FileText, Loader2, Minus, Plus, Printer, Trash2, Truck } from "lucide-react";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { PRESETS, type FormatKey, type PresetKey } from "./card";
import {
  QUEUE_MAX_QTY, STATUS_DAB, STATUS_LABEL, US_STATES, cardWords, codeOrderNumber, isOrderStatus, quoteFor, sheetsFor,
  type CodePrintPricing, type ShipAddress,
} from "@/lib/printQueueFormat";
import { cn } from "@/lib/utils";
import PaymentSummary from "@/components/payments/PaymentSummary";
import PayButton from "@/components/payments/PayButton";

export type QueueItem = {
  id: string; qty: number; title: string; slug: string; imageUrl: string; code: string; preset: string;
  venue: string | null; discountPct: number | null; live: boolean; inReview: boolean; svg: string;
};
export type QueueGroup = {
  format: FormatKey; name: string; size: string; perSheet: number; sheetCount: number;
  paper: { buy: string; avery: string | null; note: string }; items: QueueItem[]; sheets: string[];
};
export type QueueOrder = {
  id: string; status: string; createdAt: string; paidAt: string | null; shippedAt: string | null; deliveredAt: string | null;
  summary: string; totalCents: number; carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; refundNote: string | null;
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
const THUMB: Record<FormatKey, string> = {
  label: "[&>svg]:h-auto [&>svg]:w-full",
  sticker: "[&>svg]:h-full [&>svg]:w-full",
  tag: "[&>svg]:h-full [&>svg]:w-auto",
  poster: "[&>svg]:h-full [&>svg]:w-auto",
};

export default function PrintQueue({ groups, pricing, infinity, orders, address, pieces, paid, canceled, testMode = false }: {
  groups: QueueGroup[]; pricing: CodePrintPricing; infinity: boolean; orders: QueueOrder[]; address: ShipAddress; pieces: number;
  paid: QueueOrder | null; canceled: QueueOrder | null;
  /** No Stripe keys: orders are saved as paid without charging. */
  testMode?: boolean;
}) {
  const router = useRouter();
  const fromProps = useMemo(() => Object.fromEntries(groups.flatMap((g) => g.items.map((i) => [i.id, i.qty]))), [groups]);
  const [qty, setQty] = useState<Record<string, number>>(fromProps);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [busy, setBusy] = useState<string>("");
  const [downloaded, setDownloaded] = useState<Partial<Record<FormatKey, boolean>>>({});

  // A refresh brings the server's numbers; keep any change still waiting to save.
  useEffect(() => { setQty((o) => ({ ...fromProps, ...Object.fromEntries(Object.keys(timers.current).filter((k) => k in fromProps).map((k) => [k, o[k]])) })); }, [fromProps]);

  const counts = useMemo(() => {
    const c: Partial<Record<FormatKey, number>> = {};
    for (const g of groups) c[g.format] = g.items.reduce((n, i) => n + (qty[i.id] ?? i.qty), 0);
    return c;
  }, [groups, qty]);
  const quote = quoteFor(counts, pricing, { infinity });
  const totalCodes = groups.reduce((n, g) => n + g.items.length, 0);
  const totalSheets = groups.reduce((n, g) => n + sheetsFor(g.format, counts[g.format] || 0), 0);

  // ---------------- queue edits ----------------
  function changeQty(item: QueueItem, next: number) {
    const v = Math.max(1, Math.min(QUEUE_MAX_QTY, Math.round(next) || 1));
    const before = qty[item.id] ?? item.qty;
    setQty((o) => ({ ...o, [item.id]: v }));
    clearTimeout(timers.current[item.id]);
    timers.current[item.id] = setTimeout(async () => {
      delete timers.current[item.id];
      try {
        const r = await fetch(`/api/studio/print-queue/${item.id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ qty: v }) });
        if (!r.ok) {
          const p = await problemFrom(r, `Couldn't change how many of ${item.title}. Try again.`);
          setQty((o) => ({ ...o, [item.id]: before }));
          failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => changeQty(item, v) });
          return;
        }
        router.refresh();
      } catch (e) {
        setQty((o) => ({ ...o, [item.id]: before }));
        failed(errorText(e, "Couldn't save that. Try again."), { retry: () => changeQty(item, v) });
      }
    }, 450);
  }

  async function remove(item: QueueItem) {
    setBusy(`rm-${item.id}`);
    try {
      const r = await fetch(`/api/studio/print-queue/${item.id}`, { method: "DELETE" });
      if (!r.ok) {
        const p = await problemFrom(r, `Couldn't remove ${item.title}. Try again.`);
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => remove(item) });
        return;
      }
      saved(`Removed ${item.title}`, { description: `Code ${item.code} still works. Add it again from QR Studio any time.` });
      router.refresh();
    } catch (e) {
      failed(errorText(e, `Couldn't remove ${item.title}. Try again.`), { retry: () => remove(item) });
    } finally { setBusy(""); }
  }

  async function changeLook(item: QueueItem, preset: PresetKey) {
    setBusy(`look-${item.id}`);
    try {
      const r = await fetch(`/api/studio/print-queue/${item.id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ preset }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't change the look. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => changeLook(item, preset) });
        return;
      }
      saved(`${item.title}: ${PRESETS[preset].name}`, { description: "Same code. The preview and sheets are updated." });
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't change the look. Try again."), { retry: () => changeLook(item, preset) });
    } finally { setBusy(""); }
  }

  async function addAll() {
    setBusy("all");
    try {
      const r = await fetch("/api/studio/print-queue", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ all: true, look: "last" }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't add your pieces. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : addAll });
        return;
      }
      const j = await r.json().catch(() => ({}));
      saved(`Added ${j.added} ${j.added === 1 ? "code" : "codes"}`, { description: `${j.formatName}s, one each. Change the look or quantity on any of them.` });
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't add your pieces. Try again."), { retry: addAll });
    } finally { setBusy(""); }
  }

  // ---------------- print at home ----------------
  async function download(g: QueueGroup) {
    setBusy(`pdf-${g.format}`);
    try {
      const r = await fetch(`/api/studio/print-queue/pdf?format=${g.format}`);
      if (!r.ok) {
        const p = await problemFrom(r, "The PDF didn't download. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => download(g) });
        return;
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `artfinity-queue-${g.format}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setDownloaded((o) => ({ ...o, [g.format]: true }));
      saved(`${g.name} PDF downloaded`, { description: "Print at 100% scale. Test-scan one card, then print the rest and mark them as printed." });
    } catch (e) {
      failed(errorText(e, "The PDF didn't download. Try again."), { retry: () => download(g) });
    } finally { setBusy(""); }
  }

  async function markPrinted(g: QueueGroup) {
    setBusy(`done-${g.format}`);
    try {
      const r = await fetch("/api/studio/print-queue/printed", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ format: g.format }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't mark them as printed. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => markPrinted(g) });
        return;
      }
      const j = await r.json().catch(() => ({}));
      saved(`Marked ${cardWords(g.format, j.cleared ?? 0)} as printed`, { description: `My codes shows them as printed ${day(new Date().toISOString())}.`, next: { label: "My codes", href: "/studio/codes" } });
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't mark them as printed. Try again."), { retry: () => markPrinted(g) });
    } finally { setBusy(""); }
  }

  // ---------------- orders ----------------
  async function retry(id: string) {
    setBusy(`retry-${id}`);
    try {
      const r = await fetch(`/api/studio/code-orders/${id}`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ action: "retry" }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Checkout didn't open. Nothing was charged. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => retry(id) });
        return;
      }
      const j = await r.json();
      window.location.assign(j.url);
    } catch (e) {
      failed(errorText(e, "Checkout didn't open. Try again."), { retry: () => retry(id) });
    } finally { setBusy(""); }
  }
  async function cancel(id: string) {
    setBusy(`cancel-${id}`);
    try {
      const r = await fetch(`/api/studio/code-orders/${id}`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ action: "cancel" }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't cancel it. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => cancel(id) });
        return;
      }
      saved("Order canceled", { description: "Nothing was charged. Your codes are still in the queue." });
      router.replace("/studio/qr/queue");
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't cancel it. Try again."), { retry: () => cancel(id) });
    } finally { setBusy(""); }
  }

  const notices = (
    <>
      {paid && isOrderStatus(paid.status) && paid.status !== "pending" && paid.status !== "canceled" && (
        <Problem tone="success" title={`Paid ${usd(paid.totalCents)}. Order ${codeOrderNumber(paid.id)} is in.`} fix={{ label: "See the order", href: "#orders" }}>
          We&apos;re printing {paid.summary}: laminated and cut. Your receipt is in your email; tracking follows when they ship.
        </Problem>
      )}
      {paid && paid.status === "pending" && (
        <Problem tone="info" title="Your payment is still going through" fix={{ label: "Refresh", onClick: () => router.refresh() }}>
          Stripe hasn&apos;t confirmed it yet. This usually takes a few seconds.
        </Problem>
      )}
      {canceled && (
        <Problem tone="info" title="Nothing was charged" fix={{ label: busy === `retry-${canceled.id}` ? "Opening checkout…" : `Pay ${usd(canceled.totalCents)}`, onClick: () => retry(canceled.id) }}>
          You left Stripe before paying. Your codes are still in the queue.
        </Problem>
      )}
    </>
  );

  if (!groups.length) {
    return (
      <div className="grid gap-6">
        {notices}
        <EmptyState
          dab="#ffd43b"
          title="Your print queue is empty"
          body="Add codes from QR Studio, from My art, or right after you upload. Then print them all at once on label sheets, or have us print, laminate and mail them to you."
          action={{ label: "Make a code", href: "/studio/qr" }}
          secondary={pieces ? { label: busy === "all" ? "Adding…" : `Add all my pieces (${pieces})`, onClick: addAll } : { label: "Upload art", href: "/studio/art/new" }}
          help={{ label: "How the print queue works", href: "/help/qr-codes/print-queue" }}
        />
        <Orders orders={orders} busy={busy} retry={retry} cancel={cancel} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {notices}
      <p className="num text-[14px] font-semibold text-ink-2" aria-live="polite">
        {quote.cards} {quote.cards === 1 ? "card" : "cards"} · {totalCodes} {totalCodes === 1 ? "code" : "codes"} · {totalSheets} {totalSheets === 1 ? "sheet" : "sheets"} to print at home
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          {groups.map((g) => {
            const n = counts[g.format] || 0;
            const sheets = sheetsFor(g.format, n);
            const free = sheets * g.perSheet - n;
            return (
              <section key={g.format} aria-labelledby={`grp-${g.format}`} className="af-card grid gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`grp-${g.format}`} className="text-[20px] font-bold">{g.name}s <span className="text-[14px] font-semibold text-ink-2">· {g.size}</span></h2>
                  <span className="num text-[13.5px] font-semibold text-ink-2">{cardWords(g.format, n)} · {sheets} {sheets === 1 ? "sheet" : "sheets"}{free ? ` · ${free} spot${free === 1 ? "" : "s"} left on the last` : ""}</span>
                </div>

                <ul className="grid gap-3" aria-label={`${g.name}s in the queue`}>
                  {g.items.map((it) => {
                    const v = qty[it.id] ?? it.qty;
                    return (
                      <li key={it.id} className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-[104px_minmax(0,1fr)_auto] sm:items-center">
                        <div className={cn("grid h-[88px] w-[88px] place-items-center overflow-hidden sm:h-[104px] sm:w-[104px] [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:drop-shadow-[0_2px_4px_rgba(21,22,27,.18)]", THUMB[g.format])}
                          dangerouslySetInnerHTML={{ __html: it.svg }} />
                        <div className="grid min-w-0 gap-1.5">
                          <b className="truncate text-[15.5px]">{it.title}</b>
                          <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-2">
                            <span className="rounded-full bg-wall px-2 py-0.5 font-bold text-ink" title="The short link inside this code">{it.code}</span>
                            {it.venue && <span>· {it.venue}</span>}
                            {it.discountPct ? <span className="rounded-full bg-sticker px-2 py-0.5 font-bold text-ink">{it.discountPct}% off</span> : null}
                            {it.inReview && <span>· in review, scans work once it&apos;s live</span>}
                            {!it.live && <span className="font-bold text-coral">· code is off</span>}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                            <label className="flex items-center gap-1.5 font-semibold">
                              <span className="sr-only">Look for {it.title}</span>
                              <span aria-hidden="true" className="text-ink-2">Look</span>
                              <select
                                value={it.preset in PRESETS ? it.preset : ""}
                                disabled={busy === `look-${it.id}`}
                                onChange={(e) => e.target.value && changeLook(it, e.target.value as PresetKey)}
                                className="min-h-[36px] rounded-lg border-[1.5px] border-line bg-white px-2 text-[13px] text-ink"
                              >
                                {!(it.preset in PRESETS) && <option value="">Your own look</option>}
                                {(Object.keys(PRESETS) as PresetKey[]).map((k) => <option key={k} value={k}>{PRESETS[k].name}</option>)}
                              </select>
                            </label>
                            <Link href={`/studio/qr?code=${it.code}`} className="inline-flex min-h-[36px] items-center font-semibold text-scan">Edit in QR Studio</Link>
                          </div>
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                          <div className="flex items-center rounded-full border-[1.5px] border-line bg-white" role="group" aria-label={`Copies of ${it.title}`}>
                            <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-wall disabled:opacity-40" aria-label={`One fewer of ${it.title}`} disabled={v <= 1} onClick={() => changeQty(it, v - 1)}>
                              <Minus className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <input
                              type="number" inputMode="numeric" min={1} max={QUEUE_MAX_QTY} value={v} aria-label={`How many of ${it.title}`}
                              onChange={(e) => changeQty(it, Number(e.target.value))}
                              className="num h-10 w-12 border-0 bg-transparent text-center text-[15px] font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button type="button" className="grid h-10 w-10 place-items-center rounded-full hover:bg-wall disabled:opacity-40" aria-label={`One more of ${it.title}`} disabled={v >= QUEUE_MAX_QTY} onClick={() => changeQty(it, v + 1)}>
                              <Plus className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                          <button type="button" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink-2 hover:text-coral" disabled={busy === `rm-${it.id}`} onClick={() => remove(it)} aria-label={`Remove ${it.title} from the queue`}>
                            {busy === `rm-${it.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {g.sheets.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-2">Your sheets, as they&apos;ll print</h3>
                    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                      {g.sheets.map((svg, i) => (
                        <figure key={i} className="grid shrink-0 gap-1">
                          <div className="w-[132px] overflow-hidden rounded border border-line bg-white shadow-[0_2px_0_var(--af-line)] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
                          <figcaption className="text-center text-[12px] text-ink-2">Sheet {i + 1} of {g.sheetCount}</figcaption>
                        </figure>
                      ))}
                      {g.sheetCount > g.sheets.length && <p className="self-center text-[12.5px] text-ink-2">+{g.sheetCount - g.sheets.length} more</p>}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 rounded-xl bg-wall p-4">
                  <h3 className="flex items-center gap-2 text-[16px] font-bold"><Printer className="h-4 w-4" aria-hidden="true" />Print at home</h3>
                  <p className="text-[14px]">
                    <span className="text-ink-2">Buy </span><b>{g.paper.buy}</b><span className="text-ink-2">. {g.paper.note}</span>
                  </p>
                  <ul className="grid gap-1 text-[13.5px] text-ink-2">
                    <li><b className="text-ink">Print at 100% scale</b> (&ldquo;Actual size&rdquo;), not &ldquo;Fit to page&rdquo;, or the cards won&apos;t line up with the sheet.</li>
                    <li><b className="text-ink">Test-scan one before you print them all:</b> print sheet 1 on plain paper, hold it over a label sheet to check the fit, and scan a card with your phone.</li>
                  </ul>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn btn-blue btn-sm" disabled={!!busy && busy.startsWith("pdf")} onClick={() => download(g)}>
                      {busy === `pdf-${g.format}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                      Download PDF ({sheets} {sheets === 1 ? "sheet" : "sheets"})
                    </button>
                    <button type="button" className={cn("btn btn-sm", downloaded[g.format] ? "btn-sticker" : "btn-ghost")} disabled={busy === `done-${g.format}`} onClick={() => markPrinted(g)}>
                      {busy === `done-${g.format}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                      Mark as printed
                    </button>
                  </div>
                  {downloaded[g.format] && <p className="text-[13px] text-ink-2" role="status">Printed them? <b className="text-ink">Mark as printed</b> clears them from the queue and dates them in My codes.</p>}
                </div>
              </section>
            );
          })}
        </div>

        <aside aria-label="Have us print them" className="grid gap-4 lg:sticky lg:top-6">
          <MailOrder quote={quote} infinity={infinity} pricing={pricing} address={address} testMode={testMode} onOrdered={(url) => window.location.assign(url)} onPriceChange={() => router.refresh()} />
        </aside>
      </div>

      <Orders orders={orders} busy={busy} retry={retry} cancel={cancel} />
    </div>
  );
}

// ---------------- "Have us print them" ----------------
function MailOrder({ quote, infinity, pricing, address, testMode, onOrdered, onPriceChange }: {
  quote: ReturnType<typeof quoteFor>; infinity: boolean; pricing: CodePrintPricing; address: ShipAddress; testMode: boolean; onOrdered: (url: string) => void; onPriceChange: () => void;
}) {
  const [a, setA] = useState<ShipAddress>(address);
  const [bad, setBad] = useState<keyof ShipAddress | null>(null);
  const [badMsg, setBadMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = useRef<Partial<Record<keyof ShipAddress, HTMLInputElement | HTMLSelectElement | null>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const set = (k: keyof ShipAddress, v: string) => { setA((o) => ({ ...o, [k]: v })); if (bad === k) setBad(null); };

  async function order(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/studio/code-orders", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ address: a, expectTotal: quote.total }) });
      if (!r.ok) {
        const j = await r.clone().json().catch(() => ({}));
        const p = await problemFrom(r, "Checkout didn't open. Nothing was charged. Try again.");
        if (p.code === "address_required" && j.field) {
          setBad(j.field);
          setBadMsg(p.message);
          refs.current[j.field as keyof ShipAddress]?.focus();
          failed(p.message, { description: "Add it below, then order again." });
        } else if (p.code === "price_changed") {
          failed(p.message, { description: `New total: ${usd(j.total ?? 0)}.` });
          onPriceChange();
        } else failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => formRef.current?.requestSubmit() });
        setBusy(false);
        return;
      }
      const j = await r.json();
      if (j.dev) saved("Test order placed", { description: "No Stripe keys here, so it's recorded as paid without charging." });
      onOrdered(j.url);
      return; // stays busy while the next page opens, so a second click can't order twice
    } catch (err) {
      failed(errorText(err, "Checkout didn't open. Nothing was charged."), { retry: () => formRef.current?.requestSubmit() });
    }
    setBusy(false);
  }

  const field = (k: keyof ShipAddress, label: string, opts: { auto: string; optional?: boolean; className?: string; inputMode?: "numeric" } = { auto: "" }) => (
    <label className={cn("grid min-w-0 gap-1 text-[12.5px] font-semibold", opts.className)}>
      <span>{label}{opts.optional && <span className="font-normal text-ink-2"> (optional)</span>}</span>
      <input
        ref={(el) => { refs.current[k] = el; }}
        name={k} value={a[k]} onChange={(e) => set(k, e.target.value)} autoComplete={opts.auto ? `shipping ${opts.auto}` : undefined} inputMode={opts.inputMode} required={!opts.optional}
        aria-invalid={bad === k || undefined} aria-describedby={bad === k ? "ship-err" : undefined}
        className={cn("min-h-[42px] w-full min-w-0 rounded-lg border-[1.5px] bg-white px-2.5 text-[15px] font-normal text-ink", bad === k ? "border-coral" : "border-line")}
      />
      {bad === k && <span id="ship-err" role="alert" className="text-[12.5px] font-semibold text-coral">{badMsg}</span>}
    </label>
  );

  return (
    <section aria-labelledby="mail-h" className="af-card grid gap-4 p-4 sm:p-5">
      <div className="grid gap-1">
        <h2 id="mail-h" className="flex items-center gap-2 text-[20px] font-bold"><Truck className="h-5 w-5" aria-hidden="true" />Have us print them</h2>
        <p className="text-[14px] text-ink-2">Laminated, pre-cut and mailed to you. Every code in your queue, ready to hang.</p>
      </div>

      <PaymentSummary
        title={null}
        className="border border-line p-3 sm:p-4"
        rows={[
          ...quote.lines.map((l) => ({ label: <>{cardWords(l.format, l.qty)} <span className="text-ink-2">× {usd(l.unit)}</span></>, cents: l.total })),
          { label: <>Shipping{quote.freeShipping && <span className="text-ink-2"> · free with Infinity</span>}</>, ...(quote.freeShipping ? { text: "Free" } : { cents: quote.shipping }) },
          ...(quote.handling > 0 ? [{ label: "Handling", cents: quote.handling }] : []),
        ]}
        tax={testMode ? "test" : "none"}
        totalCents={quote.total}
        footer={<span className="font-semibold text-earned">At cost: we don&apos;t make money on these.</span>}
      />
      {!infinity && pricing.infinityFreeShipping && <p className="text-[12.5px] text-ink-2">Shipping is free on the <Link href="/studio/infinity" className="font-semibold text-scan">Infinity plan</Link>.</p>}

      <form ref={formRef} id="ship" onSubmit={order} className="grid scroll-mt-24 gap-3" noValidate>
        <fieldset className="grid grid-cols-6 gap-2.5">
          <legend className="mb-1 text-[14px] font-bold">Mail them to</legend>
          {field("name", "Name", { auto: "name", className: "col-span-6" })}
          {field("line1", "Street address", { auto: "address-line1", className: "col-span-6" })}
          {field("line2", "Apt, suite, studio", { auto: "address-line2", optional: true, className: "col-span-6" })}
          {field("city", "City", { auto: "address-level2", className: "col-span-6 sm:col-span-3 lg:col-span-6" })}
          <label className="col-span-3 grid min-w-0 gap-1 text-[12.5px] font-semibold sm:col-span-1 lg:col-span-3">
            State
            <select
              ref={(el) => { refs.current.state = el; }}
              name="state" value={a.state} onChange={(e) => set("state", e.target.value)} autoComplete="shipping address-level1" aria-invalid={bad === "state" || undefined} aria-describedby={bad === "state" ? "ship-err" : undefined}
              className={cn("min-h-[42px] w-full min-w-0 rounded-lg border-[1.5px] bg-white px-2 text-[15px] font-normal text-ink", bad === "state" ? "border-coral" : "border-line")}
            >
              <option value="">State</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {bad === "state" && <span id="ship-err" role="alert" className="text-[12.5px] font-semibold text-coral">{badMsg}</span>}
          </label>
          {field("zip", "ZIP", { auto: "postal-code", inputMode: "numeric", className: "col-span-3 sm:col-span-2 lg:col-span-3" })}
        </fieldset>
        <p className="text-[12.5px] text-ink-2">US addresses only. We mail them with tracking.</p>
        <PayButton type="submit" amountCents={quote.total} busy={busy} disabled={!quote.cards} className="btn btn-blue w-full" />
        <p className="text-[12px] text-ink-2">{testMode ? "Test mode: saved as paid, no card needed." : "Secure payment by Stripe: Apple Pay, Google Pay or card."} We email your receipt, then tracking when they ship.</p>
      </form>
    </section>
  );
}

// ---------------- order history ----------------
function Orders({ orders, busy, retry, cancel }: { orders: QueueOrder[]; busy: string; retry: (id: string) => void; cancel: (id: string) => void }) {
  if (!orders.length) return null;
  return (
    <section id="orders" aria-labelledby="orders-h" className="grid scroll-mt-24 gap-3">
      <h2 id="orders-h" className="text-[20px] font-bold">Printed by us</h2>
      <ul className="grid gap-3">
        {orders.map((o) => {
          const st = isOrderStatus(o.status) ? o.status : "pending";
          return (
            <li key={o.id} className="af-panel grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="num">{codeOrderNumber(o.id)}</b>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-wall px-2 py-0.5 text-[12px] font-bold">
                    <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: STATUS_DAB[st] }} aria-hidden="true" />{STATUS_LABEL[st]}
                  </span>
                </div>
                <span className="text-[13.5px] text-ink-2">
                  {o.summary} · {usd(o.totalCents)} · ordered {day(o.createdAt)}
                  {o.shippedAt && ` · shipped ${day(o.shippedAt)}`}{o.deliveredAt && ` · delivered ${day(o.deliveredAt)}`}
                </span>
                {o.refundNote && <span className="text-[13px] text-ink-2">Refund: {o.refundNote}</span>}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {o.trackingNumber && (o.trackingUrl ? (
                  <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Track {o.carrier} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>
                ) : <span className="text-[13px] text-ink-2">{o.carrier} {o.trackingNumber}</span>)}
                {st === "pending" && (
                  <>
                    <button type="button" className="btn btn-blue btn-sm" disabled={!!busy} onClick={() => retry(o.id)}>{busy === `retry-${o.id}` ? "Opening checkout…" : "Try again"}</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => cancel(o.id)}>Cancel</button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
