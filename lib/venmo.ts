// Venmo handle helpers for payouts. Pure (safe on server and client).

/** How long an emailed "confirm your new Venmo" link works. */
export const VENMO_CONFIRM_HOURS = 24;

/** "@name" for a valid handle, null for empty (remove), undefined when it isn't a valid handle. */
export function normalizeVenmo(raw: string | null | undefined): string | null | undefined {
  const t = String(raw || "").trim().replace(/\s+/g, "");
  if (!t) return null;
  const h = t.startsWith("@") ? t : "@" + t;
  return /^@[A-Za-z0-9_-]{1,29}$/.test(h) ? h : undefined;
}

export function sameVenmo(a: string | null | undefined, b: string | null | undefined) {
  return (a || "").replace(/^@/, "").toLowerCase() === (b || "").replace(/^@/, "").toLowerCase();
}
