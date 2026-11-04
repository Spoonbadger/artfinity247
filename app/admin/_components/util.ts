export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)) };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function usd(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function normalizeSize(raw: string | null | undefined): "S" | "M" | "L" | "XL" {
  const v = (raw || "").toUpperCase();
  if (v.startsWith("XL")) return "XL";
  if (v.startsWith("S")) return "S";
  if (v.startsWith("L")) return "L";
  return "M";
}

export const SIZE_LABEL: Record<string, string> = { S: "Small 5×7", M: "Medium 8×12", L: "Large 11×17", XL: "XL 18×24" };
