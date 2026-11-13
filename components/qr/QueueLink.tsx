// "Print queue" button with how many cards are waiting, for page headers (QR Studio, My codes).
import Link from "next/link";
import { ListChecks } from "lucide-react";

export default function QueueLink({ count }: { count: number }) {
  return (
    <Link href="/studio/qr/queue" className="btn btn-ghost btn-sm" aria-label={count ? `Print queue, ${count} ${count === 1 ? "card" : "cards"} waiting` : "Print queue, empty"}>
      <ListChecks className="h-4 w-4" aria-hidden="true" />
      Print queue
      {count > 0 && <span className="num rounded-full bg-coral px-1.5 text-[12px] font-bold leading-[18px] text-white" aria-hidden="true">{count > 999 ? "999+" : count}</span>}
    </Link>
  );
}
