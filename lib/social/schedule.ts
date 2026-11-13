// Posting slots: at most `maxPerDay` posts a day, at the chosen New York times. Pure (no DB), so it's easy to test.
const TZ = "America/New_York";

/** New York wall-clock parts of a moment. */
function nyParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute };
}

/** The UTC moment for a New York date + "HH:MM" (handles daylight saving). */
export function nyTime(y: number, m: number, d: number, hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  // guess with -5h, then correct by the offset New York actually had at that moment
  let t = Date.UTC(y, m - 1, d, hh + 5, mm);
  for (let i = 0; i < 2; i++) {
    const p = nyParts(new Date(t));
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    t += Date.UTC(y, m - 1, d, hh, mm) - shown;
  }
  return new Date(t);
}

export const nyDay = (d: Date) => { const p = nyParts(d); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };

/**
 * Next free slots for `count` posts after `now`, given slots already taken. Days hold at most `maxPerDay` posts, at the
 * listed times (a slot within 10 minutes of a taken one counts as taken).
 */
export function nextSlots(o: { now: Date; times: string[]; maxPerDay: number; taken: Date[]; count: number }): Date[] {
  const times = o.times.length ? [...o.times].sort() : ["12:00"];
  const taken = [...o.taken];
  const out: Date[] = [];
  const start = nyParts(o.now);
  for (let day = 0; day < 120 && out.length < o.count; day++) {
    const base = new Date(Date.UTC(start.y, start.m - 1, start.d + day, 12));
    const p = nyParts(base);
    const key = nyDay(base);
    let used = taken.filter((t) => nyDay(t) === key).length;
    for (const hhmm of times) {
      if (out.length >= o.count || used >= o.maxPerDay) break;
      const at = nyTime(p.y, p.m, p.d, hhmm);
      if (at.getTime() <= o.now.getTime() + 60_000) continue;
      if (taken.some((t) => Math.abs(t.getTime() - at.getTime()) < 10 * 60_000)) continue;
      out.push(at);
      taken.push(at);
      used++;
    }
  }
  return out;
}

export const whenNY = (d: Date) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
