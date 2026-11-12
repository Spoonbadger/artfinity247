// Uploads one image from the device and resolves with what POST /api/uploads returns:
// { url, width, height, printable, printableSig }. Every device upload on the site goes through here.
//
// With Cloudinary on (production), the file goes straight from the browser to Cloudinary, because Vercel refuses
// request bodies over 4.5 MB and print-quality originals are often 10–25 MB:
//   1. POST /api/uploads/sign  -> signed parameters for a private upload into this artist's (or order's) folder
//   2. the file goes to Cloudinary with them (byte progress comes from here)
//   3. POST /api/uploads/finish -> we check it's theirs, make the preview and measure the print sizes
// Without Cloudinary (local dev, tests) step 1 answers { local: true } and the file is posted to /api/uploads as before.
import { cloudinaryErrorText, MAX_UPLOAD_BYTES, UPLOAD_ERRORS } from "@/lib/uploadLimits";

export type UploadedImage = { url: string; width: number; height: number; printable: string[]; printableSig: string };

/** Whose upload this is: an artist (default; "photo" for a profile or verification picture) or a buyer's signed link. */
export type UploadFor = { kind?: "photo"; reviewOrder?: string; reviewToken?: string; helpOrder?: string; helpToken?: string };

/** An upload that didn't go through; `message` is ready to show. `code` is the server's (e.g. "file_too_big"). */
export class UploadFailed extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
    this.name = "UploadFailed";
  }
}

const OFFLINE = "Upload failed. Check your connection and try again.";
const FAILED = "Upload failed. Try again.";

type Opts = { onProgress?: (fraction: number) => void; signal?: AbortSignal };

/** POST a form with byte progress. Resolves with the status and parsed JSON (or {}). */
function post(url: string, body: FormData, o: Opts): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    if (o.signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    o.signal?.addEventListener("abort", onAbort, { once: true });
    const finish = () => o.signal?.removeEventListener("abort", onAbort);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) o.onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      finish();
      let data: any = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => { finish(); reject(new UploadFailed(OFFLINE, "offline")); };
    xhr.onabort = () => { finish(); reject(new DOMException("Aborted", "AbortError")); };
    xhr.open("POST", url);
    xhr.send(body);
  });
}

async function json(url: string, body: unknown, signal?: AbortSignal): Promise<{ status: number; data: any }> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include", signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new UploadFailed(OFFLINE, "offline");
  }
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const ok = (r: { status: number }) => r.status >= 200 && r.status < 300;

/** Our routes answer { error, code } when they refuse. */
const failure = (r: { status: number; data: any }) =>
  new UploadFailed(r.data?.error || (r.status === 401 ? "You're logged out. Log in and try again." : FAILED), r.data?.code, r.status);

function result(r: { status: number; data: any }): UploadedImage {
  if (ok(r) && r.data?.url) return r.data as UploadedImage;
  throw failure(r);
}

/** Uploads `file` for `who`. Rejects with UploadFailed (plain message), or an AbortError when `signal` aborts. */
export async function uploadImage(file: File, who: UploadFor = {}, o: Opts = {}): Promise<UploadedImage> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadFailed(UPLOAD_ERRORS.tooBig, "file_too_big", 413);
  const fields = Object.entries(who).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "");

  const sign = await json("/api/uploads/sign", who, o.signal);
  if (!ok(sign)) throw failure(sign);
  const s = sign.data as { local?: boolean; url?: string; fields?: Record<string, string>; publicId?: string; ticket?: string };

  // No Cloudinary (local dev): the file goes through our server, saved under public/uploads.
  if (s.local || !s.url || !s.fields) {
    const fd = new FormData();
    fd.append("file", file);
    for (const [k, v] of fields) fd.append(k, v);
    return result(await post("/api/uploads", fd, o));
  }

  // Straight to Cloudinary, as a private original in this person's folder (the signature pins where it goes).
  const fd = new FormData();
  for (const [k, v] of Object.entries(s.fields)) fd.append(k, v);
  fd.append("file", file);
  const up = await post(s.url, fd, o);
  if (!ok(up) || !up.data?.public_id) {
    const p = cloudinaryErrorText(up.data?.error?.message);
    throw new UploadFailed(p.error, p.code, up.status);
  }
  return result(await json("/api/uploads/finish", { ...who, publicId: s.publicId, ticket: s.ticket, format: up.data.format }, o.signal));
}
