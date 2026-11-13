// POST /api/uploads/import  (JSON, signed-in artist)
// Imports paintings the artist picked in Google Drive or Dropbox (components/studio/cloudImport.tsx) into the upload
// queue on /studio/art/new:
//   { source: "drive", files: [{ id, name, mimeType }], accessToken }   access token from the Google Picker (drive.file scope)
//   { source: "dropbox", files: [{ link, name, bytes }] }               temporary direct links from the Dropbox Chooser
//   { source: "mock", files: [{ link, name }] }                          dev only (ALLOW_MOCK_IMPORT=1): ./sample serves them
// Each file is downloaded server-side under the upload limits (lib/cloudImport/download.ts, allowlists in
// lib/cloudImport/sources.ts: only www.googleapis.com and the Dropbox content hosts, never private addresses) and then
// goes through exactly the same pipeline as POST /api/uploads (lib/uploadPipeline.ts processUpload). The Drive token is
// used for these downloads only; it is never stored or logged.
// Returns { results: [...] } in request order:
//   { ok: true, name, url, width, height, printable, printableSig, duplicate, duplicateOther }  (the /api/uploads shape,
//     plus duplicate = { slug, title } when the artist already has this picture, duplicateOther = looks like someone else's)
//   { ok: false, name, error, code, retry }   code: link_expired, drive_access_expired, not_image, heic_unreadable,
//     file_too_big, unreadable_image, not_found, source_busy, timeout, rate_limited, ... (client fixes: cloudImport.tsx importFix)
// A request that can't start answers { error, code } with a 4xx status.
//
// GET /api/uploads/import  (dev mock only, 404 otherwise): files for the mock picker (?problems=1 adds failing ones).
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { QUEUE_MAX } from "@/lib/uploadLimits";
import { artistUploadTarget, processUpload, UnreadableImage, UPLOAD_ERRORS, uploadProblem, type UploadResult, type UploadTarget } from "@/lib/uploadPipeline";
import { duplicateOfUpload } from "@/lib/imageHash";
import { downloadLimited, ImportError } from "@/lib/cloudImport/download";
import {
  driveDownloadUrl, dropboxUrl, importedType, isDriveMediaUrl, isHeic, isImportType, mockImportAllowed, mockUrl, type ImportSource,
} from "@/lib/cloudImport/sources";
import { mockSamples } from "./sample/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Files downloaded at once within one request. */
const CONCURRENCY = 3;
/** Imported files per artist per hour (each request is also limited, below). */
const FILES_PER_HOUR = QUEUE_MAX * 4;
/** Stop starting new downloads after this, so a big request answers before the platform's time limit. */
const REQUEST_BUDGET_MS = 50_000;

type Duplicate = { duplicate: { slug: string; title: string } | null; duplicateOther: boolean };
type FileResult = ({ ok: true; name: string } & UploadResult & Duplicate) | { ok: false; name: string; error: string; code: string; retry: boolean };
type Picked = { name: string; url: URL | null; declaredType?: string; declaredBytes?: number };

const SOURCE_NAME: Record<ImportSource, string> = { drive: "Google Drive", dropbox: "Dropbox", mock: "The sample folder" };

const fail = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status, headers: { "Cache-Control": "no-store" } });
const cleanName = (raw: unknown) => (typeof raw === "string" ? raw.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) : "") || "image";

function httpError(source: ImportSource) {
  return (status: number) => {
    if (source === "drive" && (status === 401 || status === 403)) return new ImportError("Google Drive access ran out. Pick the file from Drive again.", 401, false, "drive_access_expired");
    if (source === "drive" && status === 404) return new ImportError("We couldn't find that file in Google Drive. It may have been moved or deleted.", 404, false, "not_found");
    // Dropbox direct links last about 4 hours; the mock behaves the same so the flow can be tested.
    if (source !== "drive" && (status === 400 || status === 403 || status === 404 || status === 410)) {
      return new ImportError(`That ${source === "dropbox" ? "Dropbox" : "sample"} link has expired. Pick the file again.`, 410, false, "link_expired");
    }
    if (status === 429 || status >= 500) return new ImportError(`${SOURCE_NAME[source]} is busy. Try again in a moment.`, 502, true, "source_busy");
    return new ImportError(`${SOURCE_NAME[source]} wouldn't send that file.`, 502, false, "source_refused");
  };
}

const NOT_IMPORTABLE = "That isn't a file we can print. Pick a JPG, PNG, WEBP, TIFF or HEIC image.";

async function importOne(source: ImportSource, f: Picked, token: string | null, target: UploadTarget, artistId: string): Promise<FileResult> {
  const name = f.name;
  let type = "";
  try {
    if (!f.url) throw new ImportError("That file can't be imported. Pick it again.", 400, false, "link_not_allowed");
    if (f.declaredType && !isImportType(importedType(null, name, f.declaredType) || "")) throw new ImportError(NOT_IMPORTABLE, 415, false, "not_image");
    if (f.declaredBytes) {
      const early = uploadProblem(f.declaredBytes, "image/*");
      if (early) throw new ImportError(early.error, early.status, false, "file_too_big");
    }
    const { buf, contentType } = await downloadLimited(f.url, {
      allow: source === "drive" ? isDriveMediaUrl : source === "dropbox" ? (u) => !!dropboxUrl(u.href) : (u) => !!mockUrl(u.href),
      headers: source === "drive" && token ? { Authorization: `Bearer ${token}` } : undefined,
      publicOnly: source !== "mock",
      httpError: httpError(source),
    });
    type = importedType(contentType, name, f.declaredType) || "";
    if (!isImportType(type)) throw new ImportError(NOT_IMPORTABLE, 415, false, "not_image");
    const problem = uploadProblem(buf.length, type);
    if (problem) throw new ImportError(problem.error, problem.status, false, problem.status === 413 ? "file_too_big" : "not_image");
    const saved = await processUpload(buf, name, target);
    const dup = await duplicateOfUpload(buf, artistId).catch(() => ({ own: null, other: false }));
    return { ok: true, name, ...saved, duplicate: dup.own, duplicateOther: dup.other };
  } catch (err) {
    if (err instanceof ImportError) return { ok: false, name, error: err.message, code: err.code, retry: err.retry };
    if (err instanceof UnreadableImage) {
      return isHeic(type)
        ? { ok: false, name, error: "We can't read HEIC photos yet. Export it as a JPG and pick it again.", code: "heic_unreadable", retry: false }
        : { ok: false, name, error: UPLOAD_ERRORS.unreadable, code: "unreadable_image", retry: false };
    }
    console.error("[uploads/import]", source, (err as Error)?.message);
    return { ok: false, name, error: "Something went wrong saving that image. Try again.", code: "server_error", retry: true };
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return fail("Log in to import.", "not_logged_in", 401);
  }
  const body = await req.json().catch(() => null);
  const source = body?.source as ImportSource;
  if (source !== "drive" && source !== "dropbox" && !(source === "mock" && mockImportAllowed())) {
    return fail("Pick files from Google Drive or Dropbox.", "bad_source", 400);
  }
  const files: unknown[] = Array.isArray(body?.files) ? body.files : [];
  if (!files.length) return fail("No files picked.", "no_files", 400);
  if (files.length > QUEUE_MAX) return fail(`Pick up to ${QUEUE_MAX} files at a time.`, "too_many_files", 400);

  let token: string | null = null;
  if (source === "drive") {
    token = typeof body.accessToken === "string" && /^[\x21-\x7e]{20,4096}$/.test(body.accessToken) ? body.accessToken : null;
    if (!token) return fail("Google Drive access ran out. Pick the files from Drive again.", "drive_access_expired", 401);
  }

  if (!rateLimit(`import-req:${user.id}`, 60, 60_000)) {
    return fail("Too many imports at once. Wait a minute and try again.", "rate_limited", 429);
  }

  const picked: Picked[] = files.map((raw) => {
    const f = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const name = cleanName(f.name);
    if (source === "drive") {
      const u = driveDownloadUrl(f.id);
      return { name, url: u ? new URL(u) : null, declaredType: typeof f.mimeType === "string" ? f.mimeType : undefined };
    }
    const bytes = typeof f.bytes === "number" && f.bytes > 0 ? f.bytes : undefined;
    return { name, url: source === "dropbox" ? dropboxUrl(f.link) : mockUrl(f.link), declaredBytes: bytes };
  });

  const target = artistUploadTarget({ id: user.id, slug: user.slug });
  const started = Date.now();
  const results: FileResult[] = new Array(picked.length);
  let next = 0;
  const worker = async () => {
    while (next < picked.length) {
      const i = next++;
      const f = picked[i];
      if (Date.now() - started > REQUEST_BUDGET_MS) {
        results[i] = { ok: false, name: f.name, error: "That took too long. Try again.", code: "timeout", retry: true };
      } else if (!rateLimit(`import-file:${user.id}`, FILES_PER_HOUR, 60 * 60_000)) {
        results[i] = { ok: false, name: f.name, error: "That's a lot of imports for one hour. Try again later.", code: "rate_limited", retry: true };
      } else {
        results[i] = await importOne(source, f, token, target, user.id);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picked.length) }, worker));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

/** Dev mock picker: generated paintings served by ./sample (and, with ?problems=1, files that fail in each way). */
export async function GET(req: NextRequest) {
  if (!mockImportAllowed()) return fail("Not found", "not_found", 404);
  try {
    await requireUser();
  } catch {
    return fail("Log in to import.", "not_logged_in", 401);
  }
  const count = Math.min(QUEUE_MAX, Math.max(1, Number(req.nextUrl.searchParams.get("count")) || 3));
  const problems = req.nextUrl.searchParams.get("problems") === "1";
  return NextResponse.json({ files: mockSamples(req.nextUrl.origin, count, problems) }, { headers: { "Cache-Control": "no-store" } });
}
