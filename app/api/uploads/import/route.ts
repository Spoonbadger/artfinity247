// POST /api/uploads/import  (JSON, signed-in artist)
// Imports paintings the artist picked in Google Drive or Dropbox (components/studio/cloudImport.tsx):
//   { source: "drive", files: [{ id, name, mimeType }], accessToken }   access token from the Google Picker (drive.file scope)
//   { source: "dropbox", files: [{ link, name, bytes }] }               temporary direct links from the Dropbox Chooser
//   { source: "mock", files: [{ link, name }] }                          dev only (ALLOW_MOCK_IMPORT=1): files the dev server serves
// Each file is downloaded server-side under the upload limits (lib/cloudImport/download.ts, allowlists in
// lib/cloudImport/sources.ts) and then goes through exactly the same pipeline as POST /api/uploads
// (lib/uploadPipeline.ts processUpload). The Drive token is used for these downloads only; it is never stored or logged.
// Returns { results: [...] } in request order: { ok: true, name, url, width, height, printable, printableSig } (the
// /api/uploads shape) or { ok: false, name, error, retry }.
//
// GET /api/uploads/import  (dev mock only, 404 otherwise): sample files for the mock picker.
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { QUEUE_MAX } from "@/lib/uploadLimits";
import { artistUploadTarget, processUpload, UnreadableImage, UPLOAD_ERRORS, uploadProblem, type UploadResult, type UploadTarget } from "@/lib/uploadPipeline";
import { downloadLimited, ImportError } from "@/lib/cloudImport/download";
import { driveDownloadUrl, dropboxUrl, importedType, isDriveMediaUrl, mockImportAllowed, mockUrl, type ImportSource } from "@/lib/cloudImport/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Files downloaded at once within one request. */
const CONCURRENCY = 3;
/** Imported files per artist per hour (each request is also limited, below). */
const FILES_PER_HOUR = QUEUE_MAX * 4;
/** Stop starting new downloads after this, so a big request answers before the platform's time limit. */
const REQUEST_BUDGET_MS = 50_000;

type FileResult = ({ ok: true; name: string } & UploadResult) | { ok: false; name: string; error: string; retry: boolean };
type Picked = { name: string; url: URL | null; declaredType?: string; declaredBytes?: number };

const SOURCE_NAME: Record<ImportSource, string> = { drive: "Google Drive", dropbox: "Dropbox", mock: "the sample folder" };

const cleanName = (raw: unknown) => (typeof raw === "string" ? raw.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) : "") || "image";

function httpError(source: ImportSource) {
  return (status: number) => {
    if (source === "drive" && (status === 401 || status === 403)) return new ImportError("Google Drive access ran out. Pick the file from Drive again.", 401);
    if (source === "drive" && status === 404) return new ImportError("We couldn't find that file in Google Drive.", 404);
    if (source === "dropbox" && (status === 400 || status === 403 || status === 404 || status === 410)) return new ImportError("That Dropbox link has expired. Pick the file from Dropbox again.", 410);
    if (status === 429 || status >= 500) return new ImportError(`${SOURCE_NAME[source]} is busy. Try again in a moment.`, 502, true);
    return new ImportError(`${SOURCE_NAME[source]} wouldn't send that file.`, 502);
  };
}

async function importOne(source: ImportSource, f: Picked, token: string | null, target: UploadTarget): Promise<FileResult> {
  const name = f.name;
  try {
    if (!f.url) throw new ImportError("That file can't be imported.", 400);
    if (f.declaredType && !/^image\//.test(f.declaredType)) throw new ImportError(UPLOAD_ERRORS.notImage, 415);
    const early = f.declaredBytes ? uploadProblem(f.declaredBytes, "image/*") : null;
    if (early) throw new ImportError(early.error, early.status);
    const { buf, contentType } = await downloadLimited(f.url, {
      allow: source === "drive" ? isDriveMediaUrl : source === "dropbox" ? (u) => !!dropboxUrl(u.href) : (u) => !!mockUrl(u.href),
      headers: source === "drive" && token ? { Authorization: `Bearer ${token}` } : undefined,
      publicOnly: source !== "mock",
      httpError: httpError(source),
    });
    const type = importedType(contentType, name, f.declaredType) || "";
    const problem = uploadProblem(buf.length, type);
    if (problem) throw new ImportError(problem.error, problem.status);
    return { ok: true, name, ...(await processUpload(buf, name, target)) };
  } catch (err) {
    if (err instanceof ImportError) return { ok: false, name, error: err.message, retry: err.retry };
    if (err instanceof UnreadableImage) return { ok: false, name, error: UPLOAD_ERRORS.unreadable, retry: false };
    console.error("[uploads/import]", source, (err as Error)?.message);
    return { ok: false, name, error: "Something went wrong saving that image. Try again.", retry: true };
  }
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Log in to import." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const source = body?.source as ImportSource;
  if (source !== "drive" && source !== "dropbox" && !(source === "mock" && mockImportAllowed())) {
    return NextResponse.json({ error: "Pick files from Google Drive or Dropbox." }, { status: 400 });
  }
  const files: unknown[] = Array.isArray(body?.files) ? body.files : [];
  if (!files.length) return NextResponse.json({ error: "No files picked." }, { status: 400 });
  if (files.length > QUEUE_MAX) return NextResponse.json({ error: `Pick up to ${QUEUE_MAX} files at a time.` }, { status: 400 });

  let token: string | null = null;
  if (source === "drive") {
    token = typeof body.accessToken === "string" && /^[\x21-\x7e]{20,4096}$/.test(body.accessToken) ? body.accessToken : null;
    if (!token) return NextResponse.json({ error: "Google Drive access ran out. Pick the files from Drive again." }, { status: 401 });
  }

  if (!rateLimit(`import-req:${user.id}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many imports at once. Wait a minute and try again." }, { status: 429 });
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
        results[i] = { ok: false, name: f.name, error: "That took too long. Try again.", retry: true };
      } else if (!rateLimit(`import-file:${user.id}`, FILES_PER_HOUR, 60 * 60_000)) {
        results[i] = { ok: false, name: f.name, error: "That's a lot of imports for one hour. Try again later.", retry: true };
      } else {
        results[i] = await importOne(source, f, token, target);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, picked.length) }, worker));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}

/** Dev mock picker: a few images the dev server already serves (public/seed), as links back to this server. */
export async function GET(req: NextRequest) {
  if (!mockImportAllowed()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Log in to import." }, { status: 401 });
  }
  const dir = path.join(process.cwd(), "public", "seed");
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  const count = Math.min(QUEUE_MAX, Math.max(1, Number(req.nextUrl.searchParams.get("count")) || 3));
  // A random run of files, so repeated tests don't always pick the same ones.
  const start = names.length ? Math.floor(Math.random() * names.length) : 0;
  const pick = Array.from({ length: Math.min(count, names.length) }, (_, k) => names[(start + k) % names.length]);
  const files = await Promise.all(
    pick.map(async (n) => ({ link: `${req.nextUrl.origin}/seed/${n}`, name: n, bytes: (await fs.stat(path.join(dir, n))).size })),
  );
  return NextResponse.json({ files });
}
