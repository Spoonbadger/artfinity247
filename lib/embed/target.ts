// What a pasted Artfinity link points at, for oEmbed (/api/embed?url=…). Pure.
//   /@handle/art/<slug>, /art/<slug>, /embed/art/<slug>                 → one artwork
//   /@handle/collections/<c>, /embed/collection/<handle>/<c>            → a collection
//   /@handle, /@handle/links, /artists/<handle>, /embed/artist/<handle> → an artist

export type EmbedTarget =
  | { kind: "art"; slug: string }
  | { kind: "artist"; handle: string }
  | { kind: "collection"; handle: string; slug: string };

const HANDLE = /^[\w.-]{1,64}$/;
const SLUG = /^[\w.-]{1,160}$/;

function dec(s: string) {
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return "";
  }
}

export function parseEmbedPath(pathname: string): EmbedTarget | null {
  const parts = pathname.split("/").filter(Boolean).map(dec);
  if (!parts.length || parts.some((p) => !p)) return null;
  const handleOf = (p: string) => {
    const h = p.replace(/^@/, "");
    return HANDLE.test(h) ? h : null;
  };
  const [a, b, c, d] = parts;

  if (a.startsWith("@")) {
    const handle = handleOf(a);
    if (!handle) return null;
    if (parts.length === 1 || (parts.length === 2 && b === "links")) return { kind: "artist", handle };
    if (parts.length === 3 && b === "art" && SLUG.test(c)) return { kind: "art", slug: c };
    if (parts.length === 3 && b === "collections" && SLUG.test(c)) return { kind: "collection", handle, slug: c };
    return null;
  }
  if (a === "art" && parts.length === 2 && SLUG.test(b)) return { kind: "art", slug: b };
  if (a === "artists" && parts.length === 2) {
    const handle = handleOf(b);
    return handle ? { kind: "artist", handle } : null;
  }
  if (a === "embed") {
    if (b === "art" && parts.length === 3 && SLUG.test(c)) return { kind: "art", slug: c };
    if (b === "artist" && parts.length === 3) {
      const handle = handleOf(c);
      return handle ? { kind: "artist", handle } : null;
    }
    if (b === "collection" && parts.length === 4) {
      const handle = handleOf(c);
      return handle && SLUG.test(d) ? { kind: "collection", handle, slug: d } : null;
    }
  }
  return null;
}

/** A full URL (any host: the caller decides whether the host matters). Bad URLs → null. */
export function parseEmbedUrl(url: string): EmbedTarget | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return parseEmbedPath(u.pathname);
  } catch {
    return null;
  }
}
