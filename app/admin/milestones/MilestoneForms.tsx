"use client";
// The owner's numbers on /admin/milestones: a small form for one card, and the live break-even calculator.
// Both save through POST /api/admin/milestones (owners only), only the fields they show.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { useAdminCan } from "../_components/AdminRole";
import { usd } from "../_components/util";
import { cn } from "@/lib/utils";
import {
  breakEven,
  centsToDollarsText,
  dollarsToCents,
  parseNumber,
  type MilestoneField,
  type MilestoneInputs,
} from "@/lib/milestonesCalc";
import { Bar, Card, Stat, Stats, StatusPill, plural, type Status } from "./parts";

export type FieldSpec = { key: MilestoneField; label: string; kind: "money" | "number" | "percent"; hint?: string };

const toText = (spec: FieldSpec, v: number | undefined) => (spec.kind === "money" ? centsToDollarsText(v) : v == null ? "" : String(v));
const fromText = (spec: FieldSpec, s: string) => (spec.kind === "money" ? dollarsToCents(s) : parseNumber(s));

function Field({ spec, value, onChange, disabled }: { spec: FieldSpec; value: string; onChange: (s: string) => void; disabled: boolean }) {
  const id = `ms-${spec.key}`;
  const bad = value.trim() !== "" && !Number.isFinite(fromText(spec, value) ?? NaN);
  return (
    <div className="grid min-w-0 content-start gap-1">
      <label htmlFor={id} className="text-[13.5px] font-semibold">{spec.label}</label>
      <div className="flex min-w-0 items-center gap-1.5">
        {spec.kind === "money" && <span aria-hidden="true" className="text-ink-2">$</span>}
        <input
          id={id} type="text" inputMode="decimal" autoComplete="off" value={value} placeholder="Not set" disabled={disabled}
          aria-invalid={bad || undefined} aria-describedby={spec.hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn("min-h-[42px] w-full min-w-0 rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[16px] text-ink", bad && "!border-coral")}
        />
        {spec.kind === "percent" && <span aria-hidden="true" className="text-ink-2">%</span>}
      </div>
      {spec.hint && <span id={`${id}-hint`} className="t-small">{spec.hint}</span>}
    </div>
  );
}

/** Text per field, and a save that posts only these fields. */
function useNumbers(fields: FieldSpec[], initial: MilestoneInputs) {
  const router = useRouter();
  const canEdit = useAdminCan("settings");
  const start = () => Object.fromEntries(fields.map((f) => [f.key, toText(f, initial[f.key])])) as Record<MilestoneField, string>;
  const [text, setText] = useState(start);
  const [base, setBase] = useState(start);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => {
    const out: MilestoneInputs = {};
    for (const f of fields) {
      const v = fromText(f, text[f.key] ?? "");
      if (v != null && Number.isFinite(v) && v >= 0) out[f.key] = v;
    }
    return out;
  }, [fields, text]);
  const invalid = fields.some((f) => {
    const v = fromText(f, text[f.key] ?? "");
    return v != null && (!Number.isFinite(v) || v < 0);
  });
  const dirty = fields.some((f) => (text[f.key] ?? "") !== (base[f.key] ?? ""));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return failed("Use numbers of 0 or more.", { description: "Fix the field in red, then save." });
    setBusy(true);
    try {
      const body = Object.fromEntries(fields.map((f) => [f.key, parsed[f.key] ?? null]));
      const r = await fetch("/api/admin/milestones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      setBase(text);
      saved("Saved");
      router.refresh();
    } catch (err: any) {
      failed(err?.message || "Couldn't save.", { description: "Nothing was changed. Try saving again." });
    } finally {
      setBusy(false);
    }
  };
  return { text, set: (k: MilestoneField, v: string) => setText((t) => ({ ...t, [k]: v })), parsed, invalid, dirty, busy, save, canEdit };
}

function SaveRow({ busy, dirty, canEdit, primary }: { busy: boolean; dirty: boolean; canEdit: boolean; primary?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={busy || !dirty || !canEdit} title={canEdit ? undefined : "Only an owner can change these."} className={cn("btn btn-sm min-h-[40px] min-w-[88px]", primary ? "btn-blue" : "btn-ghost")}>
        {busy ? "Saving" : "Save"}
      </button>
      {!canEdit && <span className="t-small">Only an owner can change these.</span>}
    </div>
  );
}

/** A few owner numbers for one card (bulk tier, running costs). */
export function NumbersForm({ fields, initial, title = "Your numbers" }: { fields: FieldSpec[]; initial: MilestoneInputs; title?: string }) {
  const f = useNumbers(fields, initial);
  return (
    <form onSubmit={f.save} className="box-inset grid gap-3 p-3 sm:p-4">
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[14.5px] font-bold">{title}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((s) => <Field key={s.key} spec={s} value={f.text[s.key] ?? ""} onChange={(v) => f.set(s.key, v)} disabled={!f.canEdit || f.busy} />)}
        </div>
      </fieldset>
      <SaveRow busy={f.busy} dirty={f.dirty} canEdit={f.canEdit} />
    </form>
  );
}

const OWN_FIELDS: FieldSpec[] = [
  { key: "ownFixedMonthlyCents", label: "Fixed cost a month", kind: "money", hint: "Printer lease or loan, space, software" },
  { key: "ownMaterialsCents", label: "Paper + ink per print", kind: "money" },
  { key: "ownPackPostCents", label: "Packaging + postage per print", kind: "money" },
  { key: "ownLaborMinutes", label: "Minutes of work per print", kind: "number" },
  { key: "ownHourlyCents", label: "Hourly rate", kind: "money" },
];

export type CalcData = {
  labCostCents: number;
  labCostWeighted: boolean;
  mixNote: string;
  printsPerMonth: number;
  printsPrevMonth: number;
  framed90: number;
};

/** 4. Print our own prints: updates as the owner types; Save keeps the numbers. */
export function BreakEvenCard({ n, data, initial }: { n: number; data: CalcData; initial: MilestoneInputs }) {
  const f = useNumbers(OWN_FIELDS, initial);
  const r = breakEven({ labCostCents: data.labCostCents, printsPerMonth: data.printsPerMonth, printsPrevMonth: data.printsPrevMonth, inputs: f.parsed });
  const status: Status = r.state === "needs" ? "needs" : r.state === "done" ? "done" : r.state === "never" ? "todo" : "going";
  const now = data.printsPerMonth;
  const next =
    r.state === "needs" ? `Add your ${r.missing.join(" and ")}.`
    : r.state === "never" ? "Lower the cost per print below the lab's, or keep using the lab."
    : r.state === "done" ? "Get real quotes for a printer and space before buying."
    : `${plural(r.breakEven! - now, "more print")} a month to break even.`;

  return (
    <Card n={n} id="own" title="Print our own prints" status={status} next={next} className="lg:col-span-2">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <p className="eyebrow">From the site</p>
          <Stats>
            <Stat label="Lab cost per print" value={usd(data.labCostCents)} note={data.mixNote} />
            <Stat label="Unframed prints, last 30 days" value={now} note={`${data.printsPrevMonth} the 30 days before`} />
          </Stats>
          <p className="t-small">
            Lab cost is from the site&apos;s cost table (lib/revenue.ts). Check it against the lab&apos;s real prices.
            Framed prints stay with the lab either way, so only unframed prints count{data.framed90 ? ` (${data.framed90} framed in 90 days left out)` : ""}.
          </p>
        </div>
        <form onSubmit={f.save} className="box-inset grid content-start gap-3 p-3 sm:p-4">
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-[14.5px] font-bold">Your numbers</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {OWN_FIELDS.map((s) => <Field key={s.key} spec={s} value={f.text[s.key] ?? ""} onChange={(v) => f.set(s.key, v)} disabled={!f.canEdit || f.busy} />)}
            </div>
          </fieldset>
          <SaveRow busy={f.busy} dirty={f.dirty} canEdit={f.canEdit} primary />
        </form>
      </div>

      <div aria-live="polite" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="eyebrow">Result</p>
          <StatusPill s={status} />
        </div>
        {r.state === "needs" ? (
          <p className="t-muted">Add your monthly fixed cost and paper + ink per print to see the break-even.</p>
        ) : (
          <>
            <Stats>
              <Stat label="Our cost per print" value={usd(r.ownVariableCents)} note={r.laborCounted ? "Materials, packaging, postage and labor" : "Labor not counted: add minutes and a rate"} />
              <Stat label="Saved per print" value={usd(r.marginCents)} tone={r.marginCents > 0 ? "earned" : "loss"} note="Lab cost minus ours" />
              <Stat label="Break-even" value={r.breakEven == null ? "Never" : `${r.breakEven} / month`} note={`Now: ${now} a month`} />
              <Stat
                label={r.monthlyCents >= 0 ? "Saving a month now" : "Loss a month now"}
                value={usd(Math.abs(r.monthlyCents))}
                tone={r.monthlyCents >= 0 ? "earned" : "loss"}
                note={`At ${now} prints a month`}
              />
            </Stats>
            {r.state === "never" ? (
              <p className="text-[15px] font-semibold">At these numbers it never pays off: each print costs us more than the lab.</p>
            ) : (
              <>
                <Bar value={now} max={r.breakEven!} label="Prints a month toward break-even" left={`${now} a month now`} right={`${r.breakEven} to break even`} done={r.state === "done"} />
                {r.state === "short" && (
                  <p className="t-small">
                    {r.monthsAway != null
                      ? `About ${plural(r.monthsAway, "month")} away if prints keep growing by ${r.growthPerMonth} a month (last 30 days vs the 30 before).`
                      : "No growth trend yet (last 30 days vs the 30 before), so no date."}
                  </p>
                )}
              </>
            )}
            <p className="t-small">Break-even = fixed cost a month ÷ (lab cost − our cost per print).</p>
          </>
        )}
      </div>
    </Card>
  );
}
