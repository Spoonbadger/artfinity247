// Delivery estimate shown on the buy page. Change the numbers here.
// Business days (Mon–Fri); holidays aren't skipped.
export const PRINT_BUSINESS_DAYS = { min: 2, max: 4 };
export const SHIP_BUSINESS_DAYS = { min: 3, max: 5 };
/** Dates follow this time zone so the server and the buyer agree on "today". */
export const DELIVERY_TZ = "America/New_York";

/** Calendar date (y, m, d) for `now` in DELIVERY_TZ, as a UTC-midnight Date. */
function todayIn(tz: string, now: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addBusinessDays(start: Date, days: number) {
  const d = new Date(start);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/** "Nov 12–18", or "Nov 28–Dec 4" across months. */
export function deliveryRange(now: Date = new Date()) {
  const today = todayIn(DELIVERY_TZ, now);
  const from = addBusinessDays(today, PRINT_BUSINESS_DAYS.min + SHIP_BUSINESS_DAYS.min);
  const to = addBusinessDays(today, PRINT_BUSINESS_DAYS.max + SHIP_BUSINESS_DAYS.max);
  const sameMonth = from.getUTCMonth() === to.getUTCMonth();
  return `${fmt(from, { month: "short", day: "numeric" })}–${sameMonth ? fmt(to, { day: "numeric" }) : fmt(to, { month: "short", day: "numeric" })}`;
}

/** The two steps before it arrives, for the thank-you page: "Printed by Nov 12", then "Arrives Nov 13–18". */
export function deliverySteps(now: Date = new Date()) {
  const today = todayIn(DELIVERY_TZ, now);
  return {
    printedBy: fmt(addBusinessDays(today, PRINT_BUSINESS_DAYS.max), { weekday: "short", month: "short", day: "numeric" }),
    arrives: deliveryRange(now),
  };
}
