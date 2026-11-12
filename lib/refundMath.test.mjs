// node --experimental-strip-types --test lib/refundMath.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { adjustmentsFrom, refundsByLine, shareAfterRefund, totalsByArtist } from "./refundMath.ts";

const REASONS = ["damaged", "buyer_return", "chargeback", "other"];
const reasonOf = (v) => (REASONS.includes(v) ? v : "other");
let seq = 0;
const row = (o) => ({
  id: `r${String(++seq).padStart(4, "0")}`, orderId: "ord_abcdefgh12", orderItemId: "i1", artistId: "artA", amountCents: 5000, shareCents: 1800,
  reversed: false, deducted: false, adjustMonth: null, reason: "other", title: "", note: "", createdAt: new Date(Date.UTC(2026, 10, 1, 0, seq)), createdByEmail: "owner@x",
  ...o,
});

test("a reversed refund pays the artist nothing; others keep the share", () => {
  const m = refundsByLine([row({ orderItemId: "a", reversed: true }), row({ orderItemId: "b" })], reasonOf);
  assert.equal(shareAfterRefund(1800, m.get("a")), 0);
  assert.equal(shareAfterRefund(1800, m.get("b")), 1800);
  assert.equal(shareAfterRefund(1800, m.get("none")), 1800);
});

test("reversed wins over deducted, and adjustMonth only comes with a deduction", () => {
  const m = refundsByLine([row({ orderItemId: "a", reversed: true, deducted: true, adjustMonth: "2026-11" }), row({ orderItemId: "b", adjustMonth: "2026-11" })], reasonOf);
  assert.equal(m.get("a").deducted, false);
  assert.equal(m.get("a").adjustMonth, null);
  assert.equal(m.get("b").adjustMonth, null);
  assert.deepEqual(adjustmentsFrom(m.values()), []);
});

test("unknown reasons read as other; the newest live row per line wins", () => {
  const m = refundsByLine([row({ orderItemId: "a", reason: "weird", shareCents: 1 }), row({ orderItemId: "a", reason: "chargeback", shareCents: 2 })], reasonOf);
  assert.equal(m.size, 1);
  assert.equal(m.get("a").shareCents, 2);
  assert.equal(m.get("a").reason, "chargeback");
  assert.equal(refundsByLine([row({ reason: "weird" })], reasonOf).get("i1").reason, "other");
});

test("Refund adjustments: negative share, per month, summed per artist, oldest first", () => {
  const rows = [
    row({ orderItemId: "a", artistId: "artA", deducted: true, adjustMonth: "2026-12", shareCents: 1500, title: "" }),
    row({ orderItemId: "b", artistId: "artA", deducted: true, adjustMonth: "2026-11", shareCents: 700 }),
    row({ orderItemId: "c", artistId: "artB", deducted: true, adjustMonth: "2026-11", shareCents: 900 }),
    row({ orderItemId: "d", artistId: null, deducted: true, adjustMonth: "2026-11", shareCents: 900 }),
    row({ orderItemId: "e", artistId: "artB", deducted: true, adjustMonth: "2026-11", shareCents: 0 }),
  ];
  const all = adjustmentsFrom(refundsByLine(rows, reasonOf).values());
  assert.deepEqual(all.map((a) => [a.orderItemId, a.cents, a.month]), [["a", -1500, "2026-12"], ["b", -700, "2026-11"], ["c", -900, "2026-11"]]);
  assert.equal(all[0].title, "Print");
  assert.equal(all[0].orderRef, "CDEFGH12");
  assert.deepEqual([...totalsByArtist(adjustmentsFrom(refundsByLine(rows, reasonOf).values(), { month: "2026-11" }))], [["artA", -700], ["artB", -900]]);
});

// The old storage replayed the audit log: a refund row set the line, an undo row cleared it. The new storage keeps one
// Refund row per refund and an undo marks every live row on the line undone. Random histories must agree.
test("same refunded lines as replaying the old audit log", () => {
  let rnd = 42;
  const rand = (n) => ((rnd = (rnd * 1103515245 + 12345) % 2 ** 31) % n);
  for (let round = 0; round < 300; round++) {
    const events = [];
    for (let k = 0; k < 12; k++) {
      const item = `i${rand(4)}`;
      events.push(rand(3) === 0
        ? { kind: "undo", item }
        : { kind: "refund", item, shareCents: 100 + rand(900), reversed: rand(2) === 0, deducted: rand(2) === 0, adjustMonth: `2026-1${rand(3)}` });
    }
    // Old: replay
    const old = new Map();
    for (const e of events) {
      if (e.kind === "undo") old.delete(e.item);
      else old.set(e.item, { shareCents: e.shareCents, reversed: e.reversed, deducted: e.deducted && !e.reversed, adjustMonth: e.deducted ? e.adjustMonth : null });
    }
    // New: Refund rows, undo stamps undoneAt on every live row for the line
    const rows = [];
    for (const e of events) {
      if (e.kind === "undo") rows.filter((r) => r.orderItemId === e.item && !r.undoneAt).forEach((r) => (r.undoneAt = new Date()));
      // recordRefund refuses a line that's already refunded in the route; rows can still pile up in a race, so allow it here
      else rows.push({ ...row({ orderItemId: e.item, shareCents: e.shareCents, reversed: e.reversed, deducted: e.deducted && !e.reversed, adjustMonth: e.deducted && !e.reversed ? e.adjustMonth : null }), undoneAt: null });
    }
    const now = refundsByLine(rows.filter((r) => !r.undoneAt), reasonOf);
    assert.deepEqual([...now.keys()].sort(), [...old.keys()].sort());
    for (const [item, o] of old) {
      const n = now.get(item);
      assert.equal(n.shareCents, o.shareCents);
      assert.equal(n.reversed, o.reversed);
      assert.equal(n.deducted, o.deducted);
      if (o.deducted) assert.equal(n.adjustMonth, o.adjustMonth);
    }
  }
});
