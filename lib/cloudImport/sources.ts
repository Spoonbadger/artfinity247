// Where POST /api/uploads/import may download from. This file has no imports so the unit check
// (lib/cloudImport/sources.test.mjs) can load it directly.
//   Google Drive: only https://www.googleapis.com/drive/v3/files/<id>?alt=media, with the artist's own short-lived token.
//   Dropbox: only the Chooser's direct-link hosts (dl.dropboxusercontent.com and its content subdomains).
//   Mock (dev only, ALLOW_MOCK_IMPORT=1): only http://localhost / 127.0.0.1, i.e. files the dev server serves.
// Anything else is refused before a request is made, and the download helper re-checks every redirect hop and refuses
// hosts that resolve to private addresses, so the route can't be used to reach internal services (SSRF).

type Env = Record<string, string | undefined>;

export type ImportSource = "drive" | "dropbox" | "mock";

export const DRIVE_HOST = "www.googleapis.com";
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** The only URL a Drive file is downloaded from, or null when the id isn't a Drive file id. */
export function driveDownloadUrl(id: unknown): string | null {
  if (typeof id !== "string" || !DRIVE_ID.test(id)) return null;
  return `https://${DRIVE_HOST}/drive/v3/files/${id}?alt=media`;
}

/** True only for the exact Drive media URL driveDownloadUrl builds (also used on every redirect hop). */
export function isDriveMediaUrl(u: URL): boolean {
  if (u.protocol !== "https:" || u.hostname !== DRIVE_HOST || u.port || u.username || u.password) return false;
  const m = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
  return !!m && DRIVE_ID.test(m[1]) && u.search === "?alt=media";
}

/** Hosts the Dropbox Chooser's direct links (linkType "direct") are served from. */
export const DROPBOX_HOSTS = ["dl.dropboxusercontent.com", "dl.dropbox.com"];
// Dropbox serves file content from per-file subdomains of dl.dropboxusercontent.com (e.g. uc1a2b3c.dl.dropboxusercontent.com).
const DROPBOX_SUBDOMAIN = /^[a-z0-9-]{1,63}\.dl\.dropboxusercontent\.com$/;

export function isDropboxHost(host: string): boolean {
  const h = host.toLowerCase();
  return DROPBOX_HOSTS.includes(h) || DROPBOX_SUBDOMAIN.test(h);
}

/** The parsed link when it's an https link on a Dropbox content host (no port, no credentials), else null. */
export function dropboxUrl(raw: unknown): URL | null {
  const u = parse(raw);
  if (!u || u.protocol !== "https:" || u.port || u.username || u.password) return null;
  return isDropboxHost(u.hostname) ? u : null;
}

/** The dev-only mock source: never on a production build, and only when ALLOW_MOCK_IMPORT=1 is set on purpose. */
export function mockImportAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.ALLOW_MOCK_IMPORT === "1";
}

/** Mock links: files served by the local dev server only. Callers must check mockImportAllowed() first. */
export function mockUrl(raw: unknown): URL | null {
  const u = parse(raw);
  if (!u || (u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password) return null;
  return u.hostname === "localhost" || u.hostname === "127.0.0.1" ? u : null;
}

function parse(raw: unknown): URL | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** Loopback, private, link-local (cloud metadata), carrier-grade NAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const a = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (v4) {
    const [p, q, r, s] = v4.slice(1).map(Number);
    if ([p, q, r, s].some((n) => n > 255)) return true;
    return (
      p === 0 || p === 10 || p === 127 || p >= 224 ||
      (p === 100 && q >= 64 && q <= 127) ||
      (p === 169 && q === 254) ||
      (p === 172 && q >= 16 && q <= 31) ||
      (p === 192 && q === 168) ||
      (p === 192 && q === 0 && r === 0) ||
      (p === 198 && (q === 18 || q === 19))
    );
  }
  if (!a.includes(":")) return true; // not an IP address at all: treat as unsafe
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(a);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (a === "::" || a === "::1") return true;
  return /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || /^ff/.test(a);
}

const IMAGE_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  tif: "image/tiff", tiff: "image/tiff", avif: "image/avif", gif: "image/gif",
};

/**
 * The image type of a downloaded file: the server's Content-Type when it says image/*, otherwise (generic
 * application/octet-stream, which Dropbox and Drive sometimes send) the type the picker reported or the file's
 * extension. null = not an image. The bytes are decoded afterwards anyway, so a mislabelled file still fails safely.
 */
export function importedType(contentType: string | null, name: string, declared?: string): string | null {
  const ct = (contentType || "").split(";")[0].trim().toLowerCase();
  if (/^image\/[\w.+-]+$/.test(ct)) return ct;
  if (ct && ct !== "application/octet-stream" && ct !== "binary/octet-stream") return null;
  const d = (declared || "").toLowerCase();
  if (/^image\/[\w.+-]+$/.test(d)) return d;
  return IMAGE_EXT[name.split(".").pop()?.toLowerCase() || ""] ?? null;
}
