// Public URLs, all under the artist's handle: /@handle, /@handle/art/<slug>, /@handle/links, /@handle/collections/<c>.
// Safe to import from client and server code.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");

const seg = (s: string) => encodeURIComponent(s);

export const artistPath = (handle: string) => `/@${seg(handle)}`;
export const artPath = (handle: string, slug: string) => `/@${seg(handle)}/art/${seg(slug)}`;
export const linksPath = (handle: string) => `/@${seg(handle)}/links`;
export const collectionsPath = (handle: string) => `/@${seg(handle)}/collections`;
export const collectionPath = (handle: string, c: string) => `/@${seg(handle)}/collections/${seg(c)}`;

/** Absolute versions. `base` defaults to the site URL. */
const abs = (path: string, base = SITE_URL) => `${base.replace(/\/$/, "")}${path}`;
export const artistUrl = (handle: string, base?: string) => abs(artistPath(handle), base);
export const artUrl = (handle: string, slug: string, base?: string) => abs(artPath(handle, slug), base);
export const linksUrl = (handle: string, base?: string) => abs(linksPath(handle), base);
export const collectionUrl = (handle: string, c: string, base?: string) => abs(collectionPath(handle, c), base);

/** Keeps every query param (scan params, utm…) when redirecting. */
export function withQuery(path: string, searchParams: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else if (v !== undefined) q.append(k, v);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
