// Downloads one picked file for POST /api/uploads/import (server-only), with the same limits as a device upload:
// the size cap (lib/uploadLimits.ts) is enforced while the bytes stream in, so an oversized file is cut off rather
// than buffered; the whole download has a timeout; redirects are followed by hand (at most 3) and every hop must pass
// the source's allowlist (lib/cloudImport/sources.ts) and resolve to a public address. The Drive token is only ever
// sent to the Drive host and is never logged or stored.
import { lookup } from "dns/promises";
import { isIP } from "net";
import { MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";
import { UPLOAD_ERRORS } from "@/lib/uploadPipeline";
import { isPrivateAddress } from "./sources";

export const IMPORT_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

/**
 * A per-file import failure the artist sees. retry = trying the same file again may work. code = what the client
 * keys its fix on (components/studio/cloudImport.tsx importFix): e.g. "link_expired" offers "Pick it again".
 */
export class ImportError extends Error {
  constructor(message: string, public status = 400, public retry = false, public code = "import_failed") {
    super(message);
  }
}

type Options = {
  /** Every URL, including redirect targets, must pass this. */
  allow: (u: URL) => boolean;
  /** Sent only to the first URL's host (the Drive token). */
  headers?: Record<string, string>;
  /** Refuse hosts that resolve to private addresses. Off only for the dev mock, which reads from localhost. */
  publicOnly: boolean;
  /** The artist-facing message for an HTTP error from the source. */
  httpError: (status: number) => ImportError;
  maxBytes?: number;
  timeoutMs?: number;
};

async function assertPublic(host: string) {
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addrs.length) throw new ImportError("We couldn't reach that file. Try again.", 502, true, "source_unreachable");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new ImportError("That link isn't allowed.", 400, false, "link_not_allowed");
}

export async function downloadLimited(url: URL, o: Options): Promise<{ buf: Buffer; contentType: string | null }> {
  const maxBytes = o.maxBytes ?? MAX_UPLOAD_BYTES;
  const signal = AbortSignal.timeout(o.timeoutMs ?? IMPORT_TIMEOUT_MS);
  const firstHost = url.host;
  let cur = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!o.allow(cur)) throw new ImportError("That link isn't allowed.", 400, false, "link_not_allowed");
      if (o.publicOnly) await assertPublic(cur.hostname);
      const res = await fetch(cur, {
        headers: cur.host === firstHost ? o.headers : undefined,
        redirect: "manual",
        cache: "no-store",
        signal,
      });
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => {});
        const loc = res.headers.get("location");
        if (!loc) throw o.httpError(res.status);
        cur = new URL(loc, cur);
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => {});
        throw o.httpError(res.status);
      }
      const declared = Number(res.headers.get("content-length") || 0);
      if (declared > maxBytes) {
        await res.body?.cancel().catch(() => {});
        throw new ImportError(UPLOAD_ERRORS.tooBig, 413, false, "file_too_big");
      }
      if (!res.body) throw new ImportError("That file was empty.", 422, false, "empty_file");
      const chunks: Uint8Array[] = [];
      let total = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new ImportError(UPLOAD_ERRORS.tooBig, 413, false, "file_too_big");
        }
        chunks.push(value);
      }
      if (!total) throw new ImportError("That file was empty.", 422, false, "empty_file");
      return { buf: Buffer.concat(chunks, total), contentType: res.headers.get("content-type") };
    }
    throw new ImportError("That link redirected too many times.", 502, false, "too_many_redirects");
  } catch (err) {
    if (err instanceof ImportError) throw err;
    if ((err as Error)?.name === "TimeoutError" || (err as Error)?.name === "AbortError") {
      throw new ImportError("That took too long to download. Try again.", 504, true, "timeout");
    }
    throw new ImportError("We couldn't download that file. Try again.", 502, true, "download_failed");
  }
}
