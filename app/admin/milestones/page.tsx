import type { Metadata } from "next";
import Link from "next/link";
import { adminOrRedirect } from "../_components/gate";
import { PageHead, Pill, type Tone } from "../_components/ui";
import { usd } from "../_components/util";
import { Problem } from "@/components/studio/Problem";
import { monthLabel } from "@/lib/balance";
import { loadMilestones, type ManualTask } from "@/lib/milestones";
import { breakEven } from "@/lib/milestonesCalc";
import { Bar, Card, EnvRow, Stat, Stats, StatusPill, plural, type Status } from "./parts";
import { BreakEvenCard, NumbersForm, type FieldSpec } from "./MilestoneForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Milestones" };

const pctText = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "0%");

const BULK_FIELDS: FieldSpec[] = [
  { key: "bulkThreshold", label: "Bulk tier: prints a month", kind: "number", hint: "Ask the lab" },
  { key: "bulkDiscountPct", label: "Bulk discount", kind: "percent" },
];
const RUNNING_FIELDS: FieldSpec[] = [
  { key: "runningCostsCents", label: "Running costs a month", kind: "money", hint: "Hosting, email, domain, tools" },
];

const CAN: Record<ManualTask["can"], { label: string; tone: Tone }> = {
  auto: { label: "Runs by itself", tone: "green" },
  key: { label: "Automate: add a key", tone: "blue" },
  setting: { label: "Automate: a setting", tone: "blue" },
  code: { label: "Automate: code change", tone: "amber" },
  person: { label: "Needs a person", tone: "grey" },
};

export default async function MilestonesPage() {
  await adminOrRedirect("/admin/milestones");
  const { inputs, payouts: p, lab, volume: v, profit, tasks } = await loadMilestones();

  // ---------- 1. Automatic payouts ----------
  const configured = p.stripeKey && p.connectWebhook;
  const notReady = p.owed.total - p.owed.ready;
  const s1: Status = configured && notReady === 0 ? "done" : p.stripeKey || p.connectWebhook || p.owed.ready > 0 ? "going" : "todo";
  const next1 = !p.stripeKey
    ? "Turn on Connect (Express accounts) in Stripe and set STRIPE_SECRET_KEY."
    : !p.connectWebhook
      ? "Add the Connect webhook (/api/webhook/connect) in Stripe and set STRIPE_CONNECT_WEBHOOK_SECRET."
      : notReady > 0
        ? `Ask ${plural(notReady, "artist")} to connect Stripe in Studio → Money.`
        : "Nothing. Payouts go out by Stripe on the 5th.";

  // ---------- 2. Orders go to the lab ----------
  const allAuto = lab.orders > 0 && lab.auto === lab.orders;
  const s2: Status = lab.provider.prodigi && allAuto ? "done" : lab.provider.id !== "none" ? "going" : "todo";
  const prodigiKey = !!process.env.PRODIGI_API_KEY?.trim();
  const next2 = !prodigiKey
    ? "Add PRODIGI_API_KEY to switch to the Prodigi API (see DEPLOY.md)."
    : !lab.provider.prodigi
      ? "Set PRINTER_PROVIDER=prodigi to send orders through the API (see DEPLOY.md)."
      : lab.orders === 0
      ? "Nothing to do. The next paid order goes to Prodigi by itself."
      : allAuto
        ? "Nothing. Every order went to the lab by itself."
        : `Check the ${plural(lab.orders - lab.auto, "order")} not sent by itself.`;

  // ---------- 3. Lab bulk rates ----------
  const threshold = inputs.bulkThreshold;
  const discount = inputs.bulkDiscountPct;
  const s3: Status = !threshold ? "needs" : v.p30 >= threshold ? "done" : v.p30 > 0 ? "going" : "todo";
  const saving3 = discount != null ? Math.round((v.labCost30 * discount) / 100) : null;
  const next3 = !threshold
    ? "Ask the lab what monthly volume gets bulk rates, and the discount."
    : v.p30 >= threshold
      ? "Ask the lab to move us to bulk pricing."
      : `${plural(Math.ceil(threshold - v.p30), "more print")} a month to reach the bulk tier.`;

  // ---------- 4. Print our own prints (status for the summary; the card works it out live) ----------
  const mixParts = (["S", "M", "L", "XL"] as const).filter((s) => v.unframedMix[s]).map((s) => `${s} ${v.unframedMix[s]}`);
  const mixNote = v.labCostWeighted ? `Weighted by 90 days of unframed sizes: ${mixParts.join(", ")}` : "No unframed prints in 90 days: plain average of the table";
  const be = breakEven({ labCostCents: v.labCostCents, printsPerMonth: v.unframed30, printsPrevMonth: v.unframedPrev30, inputs });
  const s4: Status = be.state === "needs" ? "needs" : be.state === "done" ? "done" : be.state === "never" ? "todo" : "going";

  // ---------- 5. Pays for itself ----------
  const costs = inputs.runningCostsCents;
  const s5: Status = costs == null ? "needs" : profit.profitLastMonth >= costs ? "done" : profit.profitLastMonth > 0 || profit.profit30 > 0 ? "going" : "todo";
  const next5 = costs == null
    ? "Add the monthly running costs."
    : profit.profitLastMonth >= costs
      ? `Nothing. ${monthLabel(profit.lastMonth)} covered the running costs.`
      : `Profit needs ${usd(costs - profit.profitLastMonth)} more a month to cover costs.`;

  const all: { title: string; short: string; s: Status; href: string }[] = [
    { title: "Automatic payouts", short: "Payouts", s: s1, href: "#payouts" },
    { title: "Orders go to the lab automatically", short: "Lab orders", s: s2, href: "#lab" },
    { title: "Lab bulk rates", short: "Bulk rates", s: s3, href: "#bulk" },
    { title: "The business pays for itself", short: "Pays for itself", s: s5, href: "#pays" },
    { title: "Print our own prints", short: "Own prints", s: s4, href: "#own" },
  ];
  const done = all.filter((m) => m.s === "done").length;
  const upNext = all.find((m) => m.s !== "done");
  const waiting = tasks.filter((t) => t.n > 0);
  const automatable = tasks.filter((t) => t.can === "key" || t.can === "setting" || t.can === "code");

  return (
    <div className="grid gap-6">
      <PageHead title="Milestones" sub="What still keeps us from running on our own." />

      <section aria-label="Progress" className="box flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
        <p className="flex w-full items-baseline gap-2 sm:w-auto">
          <b className="t-num">{done}</b>
          <span className="t-muted">of {all.length} done</span>
        </p>
        <ol className="flex min-w-0 flex-1 flex-wrap gap-2">
          {all.map((m, i) => (
            <li key={m.href}>
              <a href={m.href} className="flex min-h-[40px] items-center gap-2 rounded-full border-[1.5px] border-edge-strong bg-white px-3 text-[14px] font-semibold text-ink no-underline hover:border-ink">
                <span><span className="num text-ink-2">{i + 1}.</span> {m.short}</span>
                <StatusPill s={m.s} />
              </a>
            </li>
          ))}
        </ol>
        {upNext && <p className="w-full text-[15px]"><b>Up next:</b> <a href={upNext.href} className="inline-flex min-h-[40px] items-center font-semibold">{upNext.title}</a></p>}
      </section>

      {p.mode === "simulated" && (
        <Problem tone="info" title="Test mode: Stripe isn't set up here.">Connecting and payouts are simulated on this server.</Problem>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card n={1} id="payouts" title="Automatic payouts (Stripe Connect)" status={s1} next={next1} link={{ href: "/admin/payouts", label: "Payouts" }}>
          <ul className="divide-y divide-line">
            <EnvRow what="Stripe" name="STRIPE_SECRET_KEY" on={p.stripeKey} />
            <EnvRow what="Connect webhook" name="STRIPE_CONNECT_WEBHOOK_SECRET" on={p.connectWebhook} />
          </ul>
          <Stats>
            <Stat label="Artists owed money now" value={p.owed.total} note={usd(p.owed.cents)} />
            <Stat label="Ready on Stripe" value={p.owed.ready} note={`${p.owed.notConnected} not connected${p.owed.pending ? `, ${p.owed.pending} Stripe not finished` : ""}`} />
          </Stats>
          {p.owed.total > 0 && (
            <Bar value={p.owed.ready} max={p.owed.total} label="Owed artists ready on Stripe" left={`${p.owed.ready} on Stripe`} right={`${p.owed.total} owed`} done={notReady === 0} />
          )}
          <p className="text-[14.5px]">
            {p.lastMonth ? (
              <>
                <b>{monthLabel(p.lastMonth)} payouts:</b> Stripe {p.lastByMethod.stripe.n} ({usd(p.lastByMethod.stripe.cents)})
                {p.lastByMethod.outside.n > 0 && <>, paid outside Stripe (before Nov 2026) {p.lastByMethod.outside.n} ({usd(p.lastByMethod.outside.cents)})</>}
              </>
            ) : (
              "No payouts sent yet."
            )}
          </p>
          {p.held > 0 && <p className="t-small"><a href="/admin/payouts#waiting" className="font-semibold">{plural(p.held, "artist")}</a> waiting on Stripe setup ({usd(p.heldCents)} held).</p>}
        </Card>

        <Card n={2} id="lab" title="Orders go to the lab automatically" status={s2} next={next2} link={{ href: "/admin/orders", label: "Orders" }}>
          <dl className="grid gap-0.5">
            <dt className="t-small">Provider</dt>
            <dd className="text-[16px] font-bold">{lab.provider.label}</dd>
            {lab.provider.detail && <dd className="t-small">{lab.provider.detail}</dd>}
          </dl>
          <Stats>
            <Stat label="Paid orders, last 30 days" value={lab.orders} />
            <Stat label="Sent by itself" value={pctText(lab.auto, lab.orders)} note={`${lab.auto} auto, ${lab.byHand} by hand${lab.notSent ? `, ${lab.notSent} not sent` : ""}`} />
          </Stats>
          {lab.orders > 0 && <Bar value={lab.auto} max={lab.orders} label="Orders sent to the lab automatically" left={`${lab.auto} by itself`} right={`${lab.orders} orders`} done={allAuto} />}
          {lab.failed > 0 && <p className="t-small text-coral">{plural(lab.failed, "work order")} failed and will be retried.</p>}
          {!lab.provider.prodigi && lab.provider.id === "email" && <p className="t-small">Email work orders work today. The lab still enters tracking by hand.</p>}
        </Card>

        <Card n={3} id="bulk" title="Lab bulk rates" status={s3} next={next3}>
          <Stats>
            <Stat label="Prints, last 30 days" value={v.p30} note={`90-day average: ${v.avg90} a month`} />
            <Stat label="Bulk tier" value={threshold ? `${threshold} / month` : "Not set"} note={discount != null ? `${discount}% off` : "Discount not set"} />
          </Stats>
          {threshold ? (
            <Bar value={v.p30} max={threshold} label="Prints a month toward the bulk tier" left={`${v.p30} now`} right={`${threshold} for bulk`} done={v.p30 >= threshold} />
          ) : null}
          <Stats>
            <Stat label="Lab cost, last 30 days" value={usd(v.labCost30)} note="From the site's cost table (lib/revenue.ts)" />
            <Stat label="Bulk saving a month" value={saving3 == null ? "Add a discount" : usd(saving3)} tone={saving3 ? "earned" : undefined} note={saving3 == null ? undefined : `At ${v.p30} prints a month`} />
          </Stats>
          <p className="t-small">Counts every print the lab made: paid orders and free reprints.</p>
          <NumbersForm fields={BULK_FIELDS} initial={inputs} />
        </Card>

        <Card n={4} id="pays" title="The business pays for itself" status={s5} next={next5}>
          <Stats>
            <Stat label={`Profit, ${monthLabel(profit.lastMonth)}`} value={usd(profit.profitLastMonth)} tone="earned" note="Last full month" />
            <Stat label="Running costs a month" value={costs == null ? "Not set" : usd(costs)} note={`Last 30 days' profit: ${usd(profit.profit30)}`} />
          </Stats>
          {costs != null && costs > 0 && (
            <Bar value={profit.profitLastMonth} max={costs} label="Last month's profit toward running costs" left={`${usd(profit.profitLastMonth)} profit`} right={`${usd(costs)} costs`} done={profit.profitLastMonth >= costs} />
          )}
          <p className="t-small">Profit is the dashboard&apos;s: after printing, fees and the artist&apos;s share.</p>
          <NumbersForm fields={RUNNING_FIELDS} initial={inputs} />
        </Card>

        <BreakEvenCard
          n={5}
          initial={inputs}
          data={{ labCostCents: v.labCostCents, labCostWeighted: v.labCostWeighted, mixNote, printsPerMonth: v.unframed30, printsPrevMonth: v.unframedPrev30, framed90: v.framed90 }}
        />
      </div>

      <section aria-labelledby="manual-h" className="box grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="manual-h" className="t-card">Still needs a person</h2>
          <span className="t-small"><b className="num text-ink">{waiting.length}</b> waiting now · <b className="num text-ink">{automatable.length}</b> could be automated</span>
        </div>
        <ul className="divide-y divide-line">
          {tasks.map((t) => (
            <li key={t.key} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3 py-2.5 sm:grid-cols-[44px_minmax(0,16rem)_minmax(0,1fr)] sm:items-center">
              <b className={t.n ? "num grid h-8 min-w-[44px] place-items-center rounded-full bg-coral/15 px-2 text-[15px] text-coral" : "num grid h-8 min-w-[44px] place-items-center rounded-full bg-wall px-2 text-[15px] text-ink-2"}>{t.n}</b>
              <Link href={t.href} className="min-w-0 break-words text-[15px] font-semibold text-ink">{t.label}</Link>
              <p className="col-start-2 min-w-0 text-[14px] text-ink-2 sm:col-start-3">
                <Pill tone={CAN[t.can].tone} className="mr-2 align-[1px]">{CAN[t.can].label}</Pill>
                {t.how}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
