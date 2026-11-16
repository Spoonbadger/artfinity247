// Opaque keyset cursors for the public API's newer list endpoints (/artworks, /artists/:handle/collections/:slug).
// A cursor is the last row's sort key and id, base64url-encoded, so a page boundary survives rows being added or
// removed (unlike an offset or a row id the database has to look up). Pure.

export type Cursor = { k: number; id: string };

const ID = /^[\w-]{1,64}$/;

function b64urlEncode(s: string) {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string) {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b + "=".repeat((4 - (b.length % 4)) % 4));
}

export function encodeCursor(c: Cursor): string {
  return b64urlEncode(`${Math.trunc(c.k)}.${c.id}`);
}

/** A cursor from the query string, or null when it is missing, malformed or tampered with. */
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw || raw.length > 120 || !/^[\w-]+$/.test(raw)) return null;
  let s: string;
  try {
    s = b64urlDecode(raw);
  } catch {
    return null;
  }
  const m = s.match(/^(-?\d{1,16})\.(.+)$/);
  if (!m || !ID.test(m[2])) return null;
  const k = Number(m[1]);
  return Number.isSafeInteger(k) ? { k, id: m[2] } : null;
}

/**
 * Prisma `where` for "rows after this cursor" when ordering by [field, id] in one direction.
 * `toValue` turns the stored number back into the column's type (e.g. ms → Date).
 */
export function afterCursor<F extends string, V>(field: F, c: Cursor, dir: "asc" | "desc", toValue: (k: number) => V) {
  const op = dir === "asc" ? "gt" : "lt";
  const v = toValue(c.k);
  return {
    OR: [{ [field]: { [op]: v } }, { [field]: v, id: { [op]: c.id } }],
  } as { OR: Record<string, unknown>[] };
}

/** Splits `limit + 1` fetched rows into the page and the next cursor (null on the last page). */
export function pageOf<T>(rows: T[], limit: number, keyOf: (row: T) => Cursor): { page: T[]; nextCursor: string | null } {
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit && page.length ? encodeCursor(keyOf(page[page.length - 1])) : null;
  return { page, nextCursor };
}
