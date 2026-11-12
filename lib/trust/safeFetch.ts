// Fetching an artist's website for the verification code, without letting that URL reach our own network (SSRF).
// Server only; node built-ins only (no "@/" imports), so node --test loads it directly.
//
//   - http and https only, no user:password@ in the URL, default ports only (80 and 443)
//   - the host is resolved first and EVERY address must be public: private, loopback, link-local, CGNAT,
//     multicast, reserved and documentation ranges are refused, IPv4 and IPv6 (and IPv4 inside IPv6)
//   - the connection goes to the address that was checked (pinned through `lookup`), so DNS can't change in between
//   - 5 s for the whole thing, 1 MB of body at most, 3 redirects at most, each one checked again
//   - a plain user agent with nothing about the artist or us beyond the product name
//
// Dev only: TRUST_FETCH_ALLOW_LOCAL=1 lets loopback (127.0.0.0/8, ::1, localhost) through on any port, so a tiny local
// test site works. It's refused in production, and it never opens the other private ranges.
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

export const FETCH_TIMEOUT_MS = 5000;
export const FETCH_MAX_BYTES = 1024 * 1024;
export const FETCH_MAX_REDIRECTS = 3;
export const FETCH_USER_AGENT = "ArtfinityVerify/1.0";

type Env = Record<string, string | undefined>;
const isProd = (env: Env) => env.NODE_ENV === "production" || env.VERCEL_ENV === "production";

/** The dev-only loopback override. Never in production. */
export function localFetchAllowed(env: Env = process.env): boolean {
  return env.TRUST_FETCH_ALLOW_LOCAL === "1" && !isProd(env);
}

function v4Parts(ip: string): number[] | null {
  const p = ip.split(".").map(Number);
  return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? p : null;
}

/** Why this IP may not be fetched ("loopback", "private", ...), or null when it's a public address. */
export function blockedIp(ip: string): string | null {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const p = v4Parts(ip)!;
    const [a, b, c] = p;
    if (a === 127) return "loopback";
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "private";
    if (a === 169 && b === 254) return "link-local";
    if (a === 100 && b >= 64 && b <= 127) return "shared (CGNAT)";
    if (a === 0) return "this network";
    if (a >= 224) return a <= 239 ? "multicast" : "reserved";
    if ((a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return "reserved";
    if (a === 198 && (b === 18 || b === 19)) return "reserved";
    if (a === 192 && b === 88 && c === 99) return "reserved";
    return null;
  }
  if (kind === 6) {
    const x = ip.toLowerCase().split("%")[0];
    // IPv4 inside IPv6 (::ffff:10.0.0.1, ::ffff:a00:1, 64:ff9b::10.0.0.1): judge the IPv4 part.
    const tail = /(?:^::ffff:|^::|^64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (tail) return blockedIp(tail[1]);
    const words = expand6(x);
    if (!words) return "invalid";
    if (words.every((w) => w === 0)) return "this network";
    if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return "loopback";
    if (words.slice(0, 5).every((w) => w === 0) && words[5] === 0xffff) return blockedIp(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
    if (words[0] === 0x64 && words[1] === 0xff9b) return blockedIp(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
    if ((words[0] & 0xfe00) === 0xfc00) return "private";
    if ((words[0] & 0xffc0) === 0xfe80) return "link-local";
    if ((words[0] & 0xffc0) === 0xfec0) return "private";
    if ((words[0] & 0xff00) === 0xff00) return "multicast";
    if (words[0] === 0x2001 && words[1] === 0x0db8) return "reserved";
    if (words[0] === 0x2001 && words[1] === 0) return "reserved"; // Teredo
    if (words[0] === 0x2002) return "reserved"; // 6to4 can wrap private IPv4
    return null;
  }
  return "invalid";
}

function expand6(ip: string): number[] | null {
  const [head, tail, extra] = ip.split("::");
  if (extra !== undefined) return null;
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail ? tail.split(":") : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  if (fill < 0 || (tail === undefined && h.length !== 8)) return null;
  const all = [...h, ...Array(fill).fill("0"), ...t];
  const nums = all.map((w) => parseInt(w, 16));
  return nums.length === 8 && nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? nums : null;
}

const isLoopback = (ip: string) => blockedIp(ip) === "loopback";

export type SafeFetchResult =
  | { ok: true; url: string; status: number; body: string; truncated: boolean }
  | { ok: false; error: string; code: "bad_url" | "blocked" | "dns" | "timeout" | "too_many_redirects" | "http" | "network" };

type Opts = { allowLocal?: boolean; timeoutMs?: number; maxBytes?: number; maxRedirects?: number; resolve?: (host: string) => Promise<string[]> };

const defaultResolve = (host: string) => dns.promises.lookup(host, { all: true, verbatim: true }).then((r) => r.map((x) => x.address));

/** Checks one URL and returns the address to connect to, or why not. */
export async function vetUrl(raw: string, o: Opts = {}): Promise<{ ok: true; url: URL; address: string } | { ok: false; error: string; code: "bad_url" | "blocked" | "dns" }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "not a web address", code: "bad_url" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "only http and https", code: "bad_url" };
  if (u.username || u.password) return { ok: false, error: "no passwords in links", code: "bad_url" };
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) return { ok: false, error: "no host", code: "bad_url" };
  const allowLocal = !!o.allowLocal;
  if (u.port && !allowLocal && !((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443"))) {
    return { ok: false, error: "only the standard web ports", code: "blocked" };
  }
  let addrs: string[];
  if (net.isIP(host)) addrs = [host];
  else if (host === "localhost" || host.endsWith(".localhost")) addrs = ["127.0.0.1"];
  else {
    if (/\.(local|internal|lan|home|corp|intranet)$/.test(host) || !host.includes(".")) return { ok: false, error: "not a public site", code: "blocked" };
    try {
      addrs = await (o.resolve || defaultResolve)(host);
    } catch {
      return { ok: false, error: "the site's address couldn't be found", code: "dns" };
    }
  }
  if (!addrs.length) return { ok: false, error: "the site's address couldn't be found", code: "dns" };
  for (const a of addrs) {
    const why = blockedIp(a);
    if (why && !(allowLocal && isLoopback(a))) return { ok: false, error: `points to a ${why} address`, code: "blocked" };
  }
  return { ok: true, url: u, address: addrs[0] };
}

/** GET a page as text, safely (see the top of the file). Never throws. */
export async function safeFetchText(raw: string, o: Opts = {}): Promise<SafeFetchResult> {
  const timeoutMs = o.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = o.maxBytes ?? FETCH_MAX_BYTES;
  const maxRedirects = o.maxRedirects ?? FETCH_MAX_REDIRECTS;
  const deadline = Date.now() + timeoutMs;
  let url = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const vet = await vetUrl(url, o);
    if (!vet.ok) return vet;
    const left = deadline - Date.now();
    if (left <= 0) return { ok: false, error: "the site took too long", code: "timeout" };
    const res = await getOnce(vet.url, vet.address, left, maxBytes);
    if (!res.ok) return res;
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      if (!res.location) return { ok: false, error: `redirect with no address (${res.status})`, code: "http" };
      if (hop === maxRedirects) return { ok: false, error: "too many redirects", code: "too_many_redirects" };
      try {
        url = new URL(res.location, vet.url).toString();
      } catch {
        return { ok: false, error: "bad redirect", code: "http" };
      }
      continue;
    }
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `the site answered ${res.status}`, code: "http" };
    return { ok: true, url: vet.url.toString(), status: res.status, body: res.body, truncated: res.truncated };
  }
  return { ok: false, error: "too many redirects", code: "too_many_redirects" };
}

type Once = { ok: true; status: number; location?: string; body: string; truncated: boolean } | { ok: false; error: string; code: "timeout" | "network" };

function getOnce(u: URL, address: string, timeoutMs: number, maxBytes: number): Promise<Once> {
  return new Promise((resolve) => {
    const family = net.isIP(address) === 6 ? 6 : 4;
    // Pin the connection to the address we checked.
    const lookup = (_h: string, opts: any, cb: any) => {
      if (typeof opts === "function") cb = opts;
      if (opts && typeof opts === "object" && opts.all) cb(null, [{ address, family }]);
      else cb(null, address, family);
    };
    const mod = u.protocol === "https:" ? https : http;
    let done = false;
    const finish = (r: Once) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname.replace(/^\[|\]$/g, ""),
        port: u.port || undefined,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        lookup,
        headers: { "User-Agent": FETCH_USER_AGENT, Accept: "text/html,text/plain;q=0.9,*/*;q=0.1", "Accept-Encoding": "identity" },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          finish({ ok: true, status, location: typeof res.headers.location === "string" ? res.headers.location : undefined, body: "", truncated: false });
          req.destroy();
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          if (done) return;
          const room = maxBytes - size;
          if (c.length >= room) {
            chunks.push(c.subarray(0, room));
            size = maxBytes;
            finish({ ok: true, status, body: Buffer.concat(chunks).toString("utf8"), truncated: true });
            req.destroy();
            return;
          }
          chunks.push(c);
          size += c.length;
        });
        res.on("end", () => finish({ ok: true, status, body: Buffer.concat(chunks).toString("utf8"), truncated: false }));
        res.on("error", (e) => finish({ ok: false, error: String(e.message || e).slice(0, 120), code: "network" }));
      },
    );
    const timer = setTimeout(() => {
      finish({ ok: false, error: "the site took too long", code: "timeout" });
      req.destroy();
    }, timeoutMs);
    req.on("error", (e) => finish({ ok: false, error: String((e as Error).message || e).slice(0, 120), code: "network" }));
    req.end();
  });
}
