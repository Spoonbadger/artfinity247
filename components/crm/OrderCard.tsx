import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIZE_TEXT, STAGE_META, STAGE_ORDER, shortDate, usd, type Stage } from "./format";

export type OrderCardData = {
  id: string;
  date: string;
  stage: Stage;
  spentCents: number;
  items: { id: string; title: string; imageUrl: string | null; size: string; framed: boolean; quantity: number; priceCents: number }[];
};

const STEP_LABEL: Record<Stage, string> = { paid: "Paid", printing: "Printer", shipped: "Shipped", delivered: "Delivered" };

/** One order: items with thumbnails, then a paint-dab timeline. */
export default function OrderCard({ order }: { order: OrderCardData }) {
  const reached = STAGE_ORDER.indexOf(order.stage);
  return (
    <article className="grid gap-3 rounded-2xl border border-line bg-white p-3 shadow-[0_2px_0_var(--af-line)] sm:p-4" aria-label={`Order from ${shortDate(order.date, true)}`}>
      <header className="flex items-baseline justify-between gap-3">
        <b className="num text-[14px]">{shortDate(order.date, true)}</b>
        <span className="num text-[13px] text-ink-2">#{order.id.slice(-6).toUpperCase()} · {usd(order.spentCents)}</span>
      </header>

      <ul className="grid gap-2.5">
        {order.items.map((it) => (
          <li key={it.id} className="flex items-center gap-3">
            {it.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.imageUrl} alt={it.title} className="h-16 w-16 shrink-0 rounded-[3px] object-cover shadow-[0_1px_0_var(--af-line)]" />
            ) : (
              <span className="h-16 w-16 shrink-0 rounded-[3px] bg-wall" aria-hidden="true" />
            )}
            <span className="grid min-w-0 flex-1">
              <b className="truncate text-[15px]">{it.title}</b>
              <span className="text-[13px] text-ink-2">
                {SIZE_TEXT[it.size] || it.size} in{it.framed ? ", framed" : ""}{it.quantity > 1 ? ` × ${it.quantity}` : ""}
              </span>
            </span>
            <span className="num shrink-0 text-[14px]">{usd(it.priceCents)}</span>
          </li>
        ))}
      </ul>

      <ol className="grid grid-cols-4 gap-1 border-t border-dashed border-line pt-3" aria-label="Order status">
        {STAGE_ORDER.map((s, i) => {
          const done = i <= reached;
          const current = i === reached;
          return (
            <li key={s} className="relative grid justify-items-center gap-1 text-center" aria-current={current ? "step" : undefined}>
              {i > 0 && (
                <span aria-hidden="true" className={cn("absolute right-[calc(50%+12px)] top-[9px] h-[3px] w-[calc(100%-20px)] rounded-full", done ? "bg-ink" : "bg-line")} />
              )}
              <span
                aria-hidden="true"
                className={cn("relative grid h-5 w-5 place-items-center", !done && "opacity-30")}
              >
                <i className="paint-dab !h-5 !w-5" style={{ ["--dab" as string]: done ? STAGE_META[s].dab : "#c9c6bf" }} />
                {done && !current && <Check className={cn("absolute h-3 w-3", s === "paid" ? "text-ink" : "text-white")} strokeWidth={3} />}
              </span>
              <span className={cn("text-[12px] leading-tight", current ? "font-bold text-ink" : done ? "text-ink" : "text-ink-2")}>
                {STEP_LABEL[s]}
                <span className="sr-only">{done ? (current ? ", current" : ", done") : ", not yet"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
