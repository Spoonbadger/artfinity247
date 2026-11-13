// WHAT THIS PROTECTS: Stripe-only payouts (lib/payoutPlan.ts, used by lib/payouts.ts and lib/balance.ts).
// (1) An artist without a payout-ready Stripe Connect account is held, never paid by hand and never flagged late.
// (2) Once they connect, the next run pays every held month, each as its own transfer with its own idempotency key,
//     and a second run (or a retry days later) finds the transfers again instead of sending money twice.
// (3) The "Connect Stripe" reminder goes out at most once per artist per 7 days.
// (4) Old payouts made outside Stripe are labelled neutrally.
// Stripe is a small in-memory stand-in (fakeStripe below), like the fake database in checkout.test.mjs.
//
// Run: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_PAID_LABEL, REMINDER_EVERY_DAYS, STRIPE_LABEL, isMonthLate, lastPayoutDay, nextPayoutDay, paidMethodCode, paidMethodLabel,
  payoutRoute, planRun, reminderStatus, transferFor, transferKey,
} from "./payoutPlan.ts";

const DAY = 86_400_000;
const at = (iso) => new Date(iso);

/** Just enough of the Stripe client for transferFor: transfers.list and transfers.create, kept in memory. */
function fakeStripe() {
  const transfers = [];
  const calls = { create: [], list: 0 };
  return {
    transfers: {
      async list({ transfer_group }) {
        calls.list++;
        return { data: transfers.filter((t) => t.transfer_group === transfer_group) };
      },
      async create(params, opts) {
        calls.create.push({ params, idempotencyKey: opts?.idempotencyKey });
        // Stripe returns the same transfer for a repeated idempotency key (within 24 hours).
        const same = transfers.find((t) => t.idempotencyKey === opts?.idempotencyKey);
        if (same) return same;
        const t = { id: `tr_${transfers.length + 1}`, reversed: false, idempotencyKey: opts?.idempotencyKey, ...params };
        transfers.push(t);
        return t;
      },
    },
    transfers_: transfers,
    calls,
  };
}

const maya = (status, months) => ({ artistId: "art_maya", stripeAccountId: status === "not_connected" ? null : "acct_123", status, months });
const HELD_MONTHS = [
  { month: "2026-09", amountCents: 4200 },
  { month: "2026-08", amountCents: 1800 },
  { month: "2026-10", amountCents: 3100 },
];

// ---------- (1) held, not late ----------

test("not connected or setup unfinished: held, nothing to pay", () => {
  assert.equal(payoutRoute("not_connected"), "held");
  assert.equal(payoutRoute("pending"), "held");
  assert.equal(payoutRoute("ready"), "stripe");
  for (const status of ["not_connected", "pending"]) {
    const plan = planRun([maya(status, HELD_MONTHS)]);
    assert.equal(plan.pay.length, 0, status);
    assert.equal(plan.held.length, 1, status);
    assert.equal(plan.held[0].totalCents, 9100);
    assert.deepEqual(plan.held[0].months.map((m) => m.month), ["2026-08", "2026-09", "2026-10"]);
  }
});

test("an unconnected artist's unpaid months are never late, however old", () => {
  const now = at("2027-03-20T12:00:00Z");
  for (const month of ["2026-08", "2026-10", "2027-01"]) {
    assert.equal(isMonthLate({ month, status: "not_connected", now }), false, month);
    assert.equal(isMonthLate({ month, status: "pending", now }), false, month);
  }
});

test("a connected artist is late only past the 8th, when the transfer failed or didn't run", () => {
  // October is due Nov 5; late from Nov 9 (LATE_AFTER_DAYS = 3, the whole 5th counts as on time).
  assert.equal(isMonthLate({ month: "2026-10", status: "ready", now: at("2026-11-08T23:00:00Z") }), false);
  assert.equal(isMonthLate({ month: "2026-10", status: "ready", now: at("2026-11-09T00:00:00Z") }), true);
  // Held at the Nov 5 run (connected after it): the next run pays them, so not late until that one is missed.
  const heldAt = at("2026-11-05T15:17:00Z");
  assert.equal(isMonthLate({ month: "2026-10", status: "ready", now: at("2026-11-20T00:00:00Z"), heldAt }), false);
  assert.equal(isMonthLate({ month: "2026-09", status: "ready", now: at("2026-11-20T00:00:00Z"), heldAt }), false);
  // Dec 5 run should have paid them; past Dec 8 with no newer hold, it's late.
  assert.equal(isMonthLate({ month: "2026-10", status: "ready", now: at("2026-12-09T00:00:00Z"), heldAt }), true);
  // A hold before the latest payout day doesn't count.
  assert.equal(isMonthLate({ month: "2026-10", status: "ready", now: at("2026-11-20T00:00:00Z"), heldAt: at("2026-11-04T00:00:00Z") }), true);
});

test("payout days: the latest 5th and the next 5th", () => {
  assert.equal(lastPayoutDay(at("2026-11-12T10:00:00Z")).toISOString(), "2026-11-05T00:00:00.000Z");
  assert.equal(lastPayoutDay(at("2026-11-05T00:00:00Z")).toISOString(), "2026-11-05T00:00:00.000Z");
  assert.equal(lastPayoutDay(at("2026-11-04T23:00:00Z")).toISOString(), "2026-10-05T00:00:00.000Z");
  assert.equal(lastPayoutDay(at("2027-01-02T00:00:00Z")).toISOString(), "2026-12-05T00:00:00.000Z");
  assert.equal(nextPayoutDay(at("2026-11-12T10:00:00Z")).toISOString(), "2026-12-05T00:00:00.000Z");
  assert.equal(nextPayoutDay(at("2026-11-05T10:00:00Z")).toISOString(), "2026-11-05T00:00:00.000Z");
  assert.equal(nextPayoutDay(at("2026-12-20T10:00:00Z")).toISOString(), "2027-01-05T00:00:00.000Z");
});

// ---------- (2) connect, then every held month is paid ----------

test("after connecting, the next run pays every held month as its own transfer, oldest first", async () => {
  // Before: held.
  assert.equal(planRun([maya("not_connected", HELD_MONTHS)]).pay.length, 0);

  // She connects. Same months, now payout-ready.
  const a = maya("ready", [...HELD_MONTHS, { month: "2026-07", amountCents: 0 }]);
  const plan = planRun([a]);
  assert.equal(plan.held.length, 0);
  assert.deepEqual(plan.pay.map((p) => p.month.month), ["2026-08", "2026-09", "2026-10"], "$0 months are skipped");
  assert.deepEqual(plan.pay.map((p) => p.idempotencyKey), ["payout:art_maya:2026-08", "payout:art_maya:2026-09", "payout:art_maya:2026-10"]);

  const stripe = fakeStripe();
  const ids = [];
  for (const p of plan.pay) ids.push(await transferFor(stripe, p.artist, p.month, `Artfinity payout for ${p.month.month}`));
  assert.equal(new Set(ids).size, 3, "one transfer per month");
  assert.deepEqual(stripe.calls.create.map((c) => [c.params.amount, c.params.destination, c.params.transfer_group, c.idempotencyKey]), [
    [1800, "acct_123", "payout_art_maya_2026-08", "payout:art_maya:2026-08"],
    [4200, "acct_123", "payout_art_maya_2026-09", "payout:art_maya:2026-09"],
    [3100, "acct_123", "payout_art_maya_2026-10", "payout:art_maya:2026-10"],
  ]);
  assert.ok(stripe.calls.create.every((c) => c.params.currency === "usd" && c.params.metadata.artistId === "art_maya"));

  // The run is retried days later (idempotency keys have expired): the transfers are found, nothing is sent twice.
  const again = [];
  for (const p of plan.pay) again.push(await transferFor(stripe, p.artist, p.month, "retry"));
  assert.deepEqual(again, ids);
  assert.equal(stripe.calls.create.length, 3);
});

test("a reversed transfer, or one to another account, doesn't count as paid", async () => {
  const stripe = fakeStripe();
  const a = maya("ready", [{ month: "2026-10", amountCents: 3100 }]);
  stripe.transfers_.push({ id: "tr_old", reversed: true, destination: "acct_123", transfer_group: "payout_art_maya_2026-10" });
  stripe.transfers_.push({ id: "tr_other", reversed: false, destination: "acct_999", transfer_group: "payout_art_maya_2026-10" });
  const id = await transferFor(stripe, a, a.months[0], "x");
  assert.notEqual(id, "tr_old");
  assert.notEqual(id, "tr_other");
  assert.equal(stripe.calls.create.length, 1);
  assert.equal(transferKey("art_maya", "2026-10"), "payout:art_maya:2026-10");
});

test("a mixed run: connected artists are paid, the rest are held", () => {
  const plan = planRun([
    { artistId: "a1", status: "ready", months: [{ month: "2026-10", amountCents: 500 }] },
    { artistId: "a2", status: "not_connected", months: [{ month: "2026-10", amountCents: 700 }] },
    { artistId: "a3", status: "pending", months: [{ month: "2026-09", amountCents: 900 }, { month: "2026-10", amountCents: 100 }] },
    { artistId: "a4", status: "not_connected", months: [{ month: "2026-10", amountCents: 0 }] },
  ]);
  assert.deepEqual(plan.pay.map((p) => p.artist.artistId), ["a1"]);
  assert.deepEqual(plan.held.map((h) => [h.artist.artistId, h.totalCents]), [["a2", 700], ["a3", 1000]]);
});

// ---------- (3) reminders ----------

test("reminders: at most one per artist per 7 days", () => {
  const now = at("2026-11-12T12:00:00Z");
  assert.equal(REMINDER_EVERY_DAYS, 7);
  assert.deepEqual(reminderStatus(null, now), { allowed: true, nextAt: null });
  const sent = new Date(now.getTime() - 3 * DAY);
  const r = reminderStatus(sent, now);
  assert.equal(r.allowed, false);
  assert.equal(r.nextAt.toISOString(), new Date(sent.getTime() + 7 * DAY).toISOString());
  assert.equal(reminderStatus(new Date(now.getTime() - 7 * DAY + 1000), now).allowed, false, "one second short of a week");
  assert.equal(reminderStatus(new Date(now.getTime() - 7 * DAY), now).allowed, true, "exactly a week");
  assert.equal(reminderStatus(new Date(now.getTime() - 30 * DAY), now).allowed, true);
});

// ---------- (4) labels ----------

test("paid methods: Stripe, refund carry, and old payouts made outside Stripe", () => {
  assert.equal(paidMethodLabel("stripe"), STRIPE_LABEL);
  assert.equal(paidMethodLabel("carried"), "Went to a refund adjustment");
  for (const legacy of ["venmo", "manual", null, undefined]) {
    assert.equal(paidMethodLabel(legacy), LEGACY_PAID_LABEL);
    assert.equal(paidMethodCode(legacy), "outside_stripe");
  }
  assert.equal(LEGACY_PAID_LABEL, "Paid outside Stripe (before Nov 2026)");
});
