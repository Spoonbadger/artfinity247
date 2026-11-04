import s from "./motion.module.css";
import { cn } from "@/lib/utils";

const DIGITS = "0123456789".split("");

/**
 * Rolling digits. Renders `to` at rest; each digit column carries --f (from) and --t (to)
 * so a parent can roll it with its own keyframes on `stripClassName`, e.g.
 * `@keyframes roll { 0% { transform: translateY(calc(var(--f) * -10%)) } 100% { transform: translateY(calc(var(--t) * -10%)) } }`.
 * `from` and `to` should be formatted to the same length ("$1,222.99" → "$1,240.45").
 */
export default function Odometer({ from, to, className, stripClassName }: { from: string; to: string; className?: string; stripClassName?: string }) {
  const f = from.padStart(to.length, " ");
  return (
    <span className={cn(s.odo, className)}>
      <span className="sr-only">{to}</span>
      <span aria-hidden="true" className="inline-flex">
        {to.split("").map((ch, i) =>
          /\d/.test(ch) ? (
            <span key={i} className={s.col}>
              <span className={cn(s.strip, stripClassName)} style={{ ["--t" as string]: ch, ["--f" as string]: /\d/.test(f[i]) ? f[i] : "0" }}>
                {DIGITS.map((d) => <span key={d}>{d}</span>)}
              </span>
            </span>
          ) : (
            <span key={i}>{ch}</span>
          ),
        )}
      </span>
    </span>
  );
}
