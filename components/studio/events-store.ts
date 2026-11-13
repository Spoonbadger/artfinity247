// Studio events are saved on the server (/api/studio/events). Older versions kept them in this
// browser under EVENTS_KEY; those are uploaded once and then cleared (see migrateLocalEvents).
export type StudioEvent = { id: string; name: string; venue: string; start: string; end: string; createdAt: string };

export const EVENTS_KEY = "af-studio-events";

/** Events left in this browser by the old local-only version. */
export function readLocalEvents(): { name: string; venue?: string; start: string; end?: string }[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((e) => e && typeof e.name === "string" && typeof e.start === "string") : [];
  } catch {
    return [];
  }
}

export function clearLocalEvents() {
  try { localStorage.removeItem(EVENTS_KEY); } catch {}
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}

export const eventsApi = {
  list: () => call<{ events: StudioEvent[] }>("/api/studio/events").then((d) => d.events),
  create: (e: { name: string; venue: string; start: string; end: string }) =>
    call<{ event: StudioEvent }>("/api/studio/events", { method: "POST", body: JSON.stringify(e) }).then((d) => d.event),
  update: (id: string, e: Partial<{ name: string; venue: string; start: string; end: string }>) =>
    call<{ event: StudioEvent }>(`/api/studio/events/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(e) }).then((d) => d.event),
  remove: (id: string) => call<{ ok: true }>(`/api/studio/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/**
 * One-time move: if this browser still has old local events and the server has none, upload
 * them, then clear the local copy. Returns the server's list when it changed, else null.
 */
let migrating: Promise<StudioEvent[] | null> | null = null;

export function migrateLocalEvents(serverCount: number): Promise<StudioEvent[] | null> {
  // Once per page load, even if a component mounts twice.
  migrating ??= doMigrate(serverCount).finally(() => { migrating = null; });
  return migrating;
}

async function doMigrate(serverCount: number): Promise<StudioEvent[] | null> {
  const local = readLocalEvents();
  if (!local.length) return null;
  // The server already has events (maybe from another browser): leave the local copy alone.
  if (serverCount > 0) return null;
  const d = await call<{ events: StudioEvent[]; imported: number }>("/api/studio/events", { method: "POST", body: JSON.stringify({ events: local }) });
  clearLocalEvents();
  return d.imported > 0 ? d.events : null;
}

/** Local "today" as YYYY-MM-DD, to compare with <input type="date"> values. */
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
