import Link from "next/link";
import { StudioPage } from "@/components/studio/StudioPage";
import BalanceCard from "@/components/money/BalanceCard";
import MoneyInsights from "@/components/money/MoneyInsights";
import PayoutsList from "@/components/money/PayoutsList";
import Ledger from "@/components/money/Ledger";
import { getBalance, PAYOUT_DAY_OF_MONTH, RETURN_WINDOW_DAYS } from "@/lib/balance";
import { FREE_SPLIT, PRO } from "@/lib/plans";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

const pct = (n: number) => `${Math.round(n * 100)}%`;
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export default async function MoneyPage() {
  const artist = await requireArtist("/studio/money");
  const b = await getBalance(artist.id);

  const how = [
    { dab: "#0f7a55", text: <>You keep <b>{pct(FREE_SPLIT)}</b> of each sale&apos;s profit. <b>{pct(PRO.split)}</b> on the {PRO.name} plan.</> },
    { dab: "#a9d8c1", text: <>Sales clear after a <b>{RETURN_WINDOW_DAYS}-day</b> return window.</> },
    { dab: "#3d9f76", text: <>Each month is paid by the <b>{ordinal(PAYOUT_DAY_OF_MONTH)}</b> of the next, to your Venmo.</> },
    { dab: "#15161b", text: <>Bulk orders of your own prints don&apos;t count.</> },
  ];

  return (
    <StudioPage
      title="Money"
      sub="Sales in. Payouts out."
      actions={<Link href="/studio/sales" className="btn btn-ghost">Sales</Link>}
    >
      {!b.venmoHandle && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[4px] border-2 border-ink bg-sticker/70 px-4 py-3 text-[14.5px]">
          <span className="sticker-badge text-[11px]">Heads up</span>
          <b className="min-w-0 flex-1">Add your Venmo so we can pay you.</b>
          <Link href="/studio/page" className="btn btn-sm bg-ink text-white">Add Venmo</Link>
        </div>
      )}

      <BalanceCard b={b} />

      {b.ledger.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-14 text-center">
          <h2 className="display text-[32px]">No sales yet.</h2>
          <p className="text-ink-2">Your earnings and payouts land here.</p>
          <Link href="/studio/qr" className="btn btn-blue">Print codes</Link>
        </div>
      ) : (
        <MoneyInsights ledger={b.ledger} nowIso={b.now} />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <PayoutsList payouts={b.payouts} ledger={b.ledger} />
        <section aria-labelledby="how-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
          <h2 id="how-h" className="text-[20px] font-bold">How payouts work</h2>
          <ul className="grid gap-2.5 text-[14.5px]">
            {how.map((h, i) => (
              <li key={i} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2.5">
                <i className="paint-dab mt-1 h-3 w-3" style={{ ["--dab" as string]: h.dab }} />
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {b.ledger.length > 0 && <Ledger ledger={b.ledger} />}
    </StudioPage>
  );
}
