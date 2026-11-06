"use client";
// The one "Pay $X" button for every payment in Artfinity (buyer checkout, Infinity, scans, printed codes, bulk prints).
// Shows the exact amount, spins while checkout opens, and ignores a second click so nobody pays twice.
// Give it `onPay` (async; the button keeps itself busy until it settles) or drive `busy` yourself with type="submit".
import { useRef, useState, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "./money";

export default function PayButton({
  amountCents, onPay, busy: busyProp, type = "button", form, label, busyLabel = "Opening checkout…", plusTax = false, disabled = false, lock = true, className = "btn btn-blue",
}: {
  amountCents: number;
  /** Starts checkout. While it runs (and after, if it navigates away) the button stays busy. Return false to reset. */
  onPay?: () => Promise<unknown> | unknown;
  /** Controlled busy state, for a form submit button. */
  busy?: boolean;
  type?: "button" | "submit";
  form?: string;
  /** Defaults to "Pay $X" (or "Pay $X + tax"). */
  label?: ReactNode;
  busyLabel?: ReactNode;
  /** Sales tax is added on Stripe's page: say so on the button, so the total there is no surprise. */
  plusTax?: boolean;
  disabled?: boolean;
  /** A small lock before the label. */
  lock?: boolean;
  className?: string;
}) {
  const [own, setOwn] = useState(false);
  const running = useRef(false);
  const busy = busyProp ?? own;

  async function click() {
    if (!onPay || running.current) return;
    running.current = true;
    setOwn(true);
    try {
      const r = await onPay();
      // false means "didn't navigate, let them try again". With a controlled `busy`, the parent says when it's done.
      if (r === false || busyProp !== undefined) { running.current = false; setOwn(false); }
    } catch {
      running.current = false;
      setOwn(false);
    }
  }

  const text = label ?? `Pay ${money(amountCents)}${plusTax ? " + tax" : ""}`;
  return (
    <button
      type={type}
      form={form}
      onClick={type === "button" ? click : undefined}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(className, "justify-center")}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : lock ? <Lock className="h-4 w-4" aria-hidden="true" /> : null}
      <span className="num">{busy ? busyLabel : text}</span>
    </button>
  );
}
