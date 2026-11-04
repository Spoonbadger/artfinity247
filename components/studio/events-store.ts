// Studio events live in this browser for now. They will sync to the artist's QR codes later.
export type StudioEvent = { id: string; name: string; venue: string; start: string; end: string; createdAt: number };

export const EVENTS_KEY = "af-studio-events";

export function readEvents(): StudioEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.name === "string") : [];
  } catch {
    return [];
  }
}

export function writeEvents(list: StudioEvent[]) {
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(list)); } catch {}
}

/** Local "today" as YYYY-MM-DD, to compare with <input type="date"> values. */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
